suppressPackageStartupMessages({
  library(RNAPeaks)
  library(ggplot2)
  library(uuid)
  library(digest)
  library(BSgenome.Hsapiens.UCSC.hg38)
})

UPLOAD_DIR <- Sys.getenv("UPLOAD_DIR", unset = "/tmp/uploads")
SESSION_TTL_SECS <- 900L # 15 minutes

# Hard cap on how long a single analysis request may run before the worker
# aborts it. A single-threaded plumber worker cannot detect a client that has
# refreshed or closed the tab, so without this a runaway/abandoned job would
# occupy the worker indefinitely and block later requests. Kept just under
# nginx's 300s proxy_read_timeout so R frees the worker before nginx gives up.
REQUEST_TIMEOUT_SECS <- as.numeric(
  Sys.getenv("REQUEST_TIMEOUT_SECS", unset = "280")
)

# ── Param helpers ───────────────────────────────────────────────────────────────

opt_str <- function(x, default = NULL) {
  if (is.null(x) || (is.character(x) && nchar(trimws(x)) == 0)) default else x
}
opt_int <- function(x, default) {
  v <- opt_str(x)
  if (is.null(v)) default else as.integer(v)
}
opt_num <- function(x, default) {
  v <- opt_str(x)
  if (is.null(v)) default else as.numeric(v)
}
opt_groups <- function(x) {
  v <- opt_str(x)
  if (is.null(v)) c("Negative", "Positive", "Control") else strsplit(v, ",")[[1]]
}
# Translate legacy group names to the new RNAPeaks vocabulary so older clients
# (or cached frontends) keep working: Retained = positive ΔΨ, Excluded = negative.
map_groups <- function(groups) {
  vapply(trimws(groups), function(g) {
    switch(g,
      Retained = "Positive",
      Excluded = "Negative",
      g
    )
  }, character(1), USE.NAMES = FALSE)
}
opt_txid <- function(x) {
  v <- opt_str(x)
  if (is.null(v) || v == "NA") NA else v
}

log_info <- function(...) message(format(Sys.time(), "[%Y-%m-%d %H:%M:%S]"), " [INFO]  ", ...)
log_error <- function(...) message(format(Sys.time(), "[%Y-%m-%d %H:%M:%S]"), " [ERROR] ", ...)

WORKER_START_TIME <- as.numeric(Sys.time())

# GTF annotations are resolved inside RNAPeaks from its bundled datasets
# (gtf_hg38 / gtf_mm10 / gtf_mm39) via the `species` argument, or from a
# user-supplied GTF file path. Nothing to preload here.
GTF_AVAILABLE <- requireNamespace("RNAPeaks", quietly = TRUE)
log_info("RNAPeaks loaded. bundled GTF available=", GTF_AVAILABLE)


# ── Helpers ────────────────────────────────────────────────────────────────────

validate_id <- function(id, label) {
  if (is.null(id) || !grepl("^[0-9a-f\\-]{1,64}$", id)) {
    stop(paste0("Invalid ", label, "."))
  }
  invisible(id)
}

get_upload_path <- function(session_id, upload_id) {
  validate_id(session_id, "session ID")
  validate_id(upload_id, "upload ID")
  path <- file.path(UPLOAD_DIR, session_id, upload_id)
  if (!file.exists(path)) stop("File session not found. Please upload your file again.")
  path
}

# ── BED resolver ───────────────────────────────────────────────────────────────
# Priority: uploaded file > bed_source ("K562" | "HepG2") > K562 default
resolve_bed <- function(req, upload_id, bed_source, endpoint) {
  bid <- opt_str(upload_id)
  if (!is.null(bid)) {
    path <- get_upload_path(req$session_id, bid)
    bed <- utils::read.table(path, header = FALSE, sep = "\t")
    log_info(endpoint, ": using uploaded BED upload_id=", bid)
  } else if (identical(opt_str(bed_source), "HepG2")) {
    bed <- RNAPeaks::HepG2_bed
    log_info(endpoint, ": using built-in HepG2_bed")
  } else {
    bed <- RNAPeaks::K562_bed
    log_info(endpoint, ": using built-in K562_bed")
  }
  bed
}

# ── Multi-BED resolver ─────────────────────────────────────────────────────────
# plot_gene / plot_region / plot_utr_binding accept a *named list* of BED data
# frames. Builds that list from any combination of built-in tracks (K562 /
# HepG2, comma-separated in `bed_sources`) and uploaded files (comma-separated
# upload IDs in `bed_upload_ids`, with matching labels in `bed_labels`).
# Falls back to the legacy single-bed params (`bed_source` / `upload_id`) and,
# ultimately, to built-in K562.
resolve_beds <- function(req, bed_sources, bed_upload_ids, bed_labels,
                         upload_id, bed_source, endpoint) {
  beds <- list()

  # Built-in tracks: plural csv, else legacy singular.
  srcs <- opt_str(bed_sources)
  src_vec <- if (!is.null(srcs)) {
    trimws(strsplit(srcs, ",")[[1]])
  } else {
    s <- opt_str(bed_source)
    if (is.null(s)) character(0) else s
  }
  for (s in src_vec) {
    if (identical(s, "HepG2")) {
      beds[["HepG2"]] <- RNAPeaks::HepG2_bed
    } else if (identical(s, "K562")) {
      beds[["K562"]] <- RNAPeaks::K562_bed
    }
  }

  # Uploaded tracks: plural csv, else legacy singular upload_id.
  ids <- opt_str(bed_upload_ids)
  id_vec <- if (!is.null(ids)) {
    trimws(strsplit(ids, ",")[[1]])
  } else {
    u <- opt_str(upload_id)
    if (is.null(u)) character(0) else u
  }
  labs <- opt_str(bed_labels)
  lab_vec <- if (!is.null(labs)) trimws(strsplit(labs, ",")[[1]]) else character(0)

  for (i in seq_along(id_vec)) {
    if (!nzchar(id_vec[i])) next
    path <- get_upload_path(req$session_id, id_vec[i])
    nm <- if (i <= length(lab_vec) && nzchar(lab_vec[i])) lab_vec[i] else paste0("bed", i)
    beds[[nm]] <- utils::read.table(path, header = FALSE, sep = "\t")
  }

  if (length(beds) == 0L) {
    beds[["K562"]] <- RNAPeaks::K562_bed
    log_info(endpoint, ": no BED supplied, using built-in K562_bed")
  } else {
    log_info(
      endpoint, ": ", length(beds), " BED track(s): ",
      paste(names(beds), collapse = ", ")
    )
  }
  beds
}

# ── GTF resolver ───────────────────────────────────────────────────────────────
# The RNAPeaks plot functions take `gtf` as an optional *file path*; when NULL
# they fall back to the bundled annotation selected by `species`. So a custom
# GTF upload just resolves to its on-disk path — no loading happens here.
resolve_gtf_path <- function(req, gtf_upload_id, endpoint) {
  gid <- opt_str(gtf_upload_id)
  if (is.null(gid)) {
    return(NULL)
  }
  path <- get_upload_path(req$session_id, gid)
  log_info(endpoint, ": using custom GTF upload_id=", gid)
  path
}

# ── Param mapping helpers (old webapp vocabulary → new RNAPeaks API) ────────────

# The old UI sends "Target" (alphabetical) or "Count"; peaks_options() expects
# "Alphabetical" or "Count".
map_order_by <- function(x) {
  v <- opt_str(x, "Count")
  if (identical(v, "Target")) "Alphabetical" else v
}

# Two separate start/stop params collapse into peaks_plot_style(highlight=c(a,b)).
resolve_highlight <- function(start, stop) {
  s <- opt_str(start)
  e <- opt_str(stop)
  if (is.null(s) || is.null(e)) {
    return(NULL)
  }
  c(as.integer(s), as.integer(e))
}

resolve_bam_ylim <- function(ymin, ymax) {
  lo <- opt_str(ymin)
  hi <- opt_str(ymax)
  if (is.null(lo) || is.null(hi)) {
    return(NULL)
  }
  c(as.numeric(lo), as.numeric(hi))
}

# Wraps prepare_bam_files and reduces its per-track fill colors to the single
# color the new API supports (style$bam_fill_color applies to all tracks).
# Returns NULL when no BAM tracks were supplied or preparation failed.
resolve_bam <- function(req, bam_upload_ids, bam_bai_ids, bam_labels, bam_fill_cols) {
  if (is.null(opt_str(bam_upload_ids)) || is.null(opt_str(bam_bai_ids))) {
    return(NULL)
  }
  info <- tryCatch(
    prepare_bam_files(
      session_id    = req$session_id,
      bam_ids_str   = opt_str(bam_upload_ids, ""),
      bai_ids_str   = opt_str(bam_bai_ids, ""),
      labels_str    = opt_str(bam_labels, ""),
      fill_cols_str = opt_str(bam_fill_cols, "navy")
    ),
    error = function(e) {
      log_error("BAM prep failed: ", conditionMessage(e))
      NULL
    }
  )
  if (is.null(info)) {
    return(NULL)
  }
  info$fill_col <- info$fill_cols[1] # new API: one fill color for all tracks
  info
}

# ── rMATS resolver ─────────────────────────────────────────────────────────────
# Uploaded rMATS table, or the bundled sample matched to the event type:
# SE -> se_mats_jc, RI -> ri_mats_jc, A5SS -> a5ss_mats_jc, A3SS -> a3ss_mats_jc.
resolve_mats <- function(req, mats_upload_id, event_type, endpoint) {
  mid <- opt_str(mats_upload_id)
  if (!is.null(mid)) {
    path <- get_upload_path(req$session_id, mid)
    log_info(endpoint, ": using uploaded rMATS upload_id=", mid)
    return(utils::read.table(path, header = TRUE, sep = "\t"))
  }
  if (identical(event_type, "RI")) {
    log_info(endpoint, ": using built-in ri_mats_jc")
    RNAPeaks::ri_mats_jc
  } else if (identical(event_type, "A5SS")) {
    log_info(endpoint, ": using built-in a5ss_mats_jc")
    RNAPeaks::a5ss_mats_jc
  } else if (identical(event_type, "A3SS")) {
    log_info(endpoint, ": using built-in a3ss_mats_jc")
    RNAPeaks::a3ss_mats_jc
  } else {
    log_info(endpoint, ": using built-in se_mats_jc")
    RNAPeaks::se_mats_jc
  }
}

# ── Splicing/sequence map param builders ───────────────────────────────────────
# Shared by the SE / RI / sequence endpoints, which all expose the same flat
# query params. Maps them onto splicing_options() / splicing_style().
#
# Old → new param remap:
#   p_valueRetainedAndExclusion        -> event_fdr    (max rMATS FDR per event)
#   p_valueControls                    -> control_pval (min rMATS PValue for control)
#   retained/exclusion_IncLevelDifference -> psi_cutoff = c(neg, pos)
#   Min_Count                          -> min_count
#   retained/excluded/control_col      -> group_colors list(Positive/Negative/Control)
build_splicing_options <- function(WidthIntoExon, WidthIntoIntron, moving_average,
                                   p_valueRetainedAndExclusion, p_valueControls,
                                   retained_IncLevelDifference, exclusion_IncLevelDifference,
                                   Min_Count, groups, control_multiplier,
                                   control_iterations, fdr_threshold) {
  splicing_options(
    width_exon = as.integer(WidthIntoExon),
    width_intron = as.integer(WidthIntoIntron),
    moving_average = as.integer(moving_average),
    event_fdr = opt_num(p_valueRetainedAndExclusion, 0.05),
    control_pval = opt_num(p_valueControls, 0.95),
    psi_cutoff = c(
      opt_num(exclusion_IncLevelDifference, -0.1),
      opt_num(retained_IncLevelDifference, 0.1)
    ),
    min_count = opt_int(Min_Count, 50),
    groups = map_groups(opt_groups(groups)),
    control_multiplier = opt_num(control_multiplier, 2.0),
    control_iterations = opt_int(control_iterations, 20),
    use_fdr = TRUE,
    fdr_threshold = opt_num(fdr_threshold, 0.05),
    verbose = FALSE
  )
}

# Split a comma-separated motif string into a clean character vector.
parse_motifs <- function(sequence) {
  motifs <- trimws(strsplit(sequence, ",")[[1]])
  motifs[nchar(motifs) > 0]
}

build_splicing_style <- function(retained_col, excluded_col, control_col, exon_col,
                                 line_width, axis_text_size, title_size) {
  splicing_style(
    group_colors = list(
      Positive = opt_str(retained_col, "blue"),
      Negative = opt_str(excluded_col, "red"),
      Control  = opt_str(control_col, "black")
    ),
    line_width = opt_num(line_width, 0.8),
    show_significance = TRUE,
    title_size = opt_num(title_size, 20),
    axis_text_size = opt_num(axis_text_size, 11),
    exon_col = opt_str(exon_col, "navy")
  )
}

# ── BAM helper ─────────────────────────────────────────────────────────────────
# Resolves comma-separated BAM/BAI upload IDs into a named bam_files vector
# suitable for PlotGene / PlotRegion.  Each pair is symlinked into a temp dir
# so Rsamtools can find the <name>.bam.bai index alongside the BAM.
prepare_bam_files <- function(session_id, bam_ids_str, bai_ids_str, labels_str, fill_cols_str) {
  bam_ids <- trimws(strsplit(bam_ids_str, ",", fixed = TRUE)[[1]])
  bai_ids <- trimws(strsplit(bai_ids_str, ",", fixed = TRUE)[[1]])
  labels <- trimws(strsplit(labels_str, ",", fixed = TRUE)[[1]])
  fill_cols <- trimws(strsplit(fill_cols_str, ",", fixed = TRUE)[[1]])

  n <- length(bam_ids)
  if (n == 0 || nchar(bam_ids[1]) == 0) {
    return(NULL)
  }

  # Pad shorter vectors to length n
  if (length(bai_ids) < n) bai_ids <- rep_len(bai_ids, n)
  if (length(labels) < n) labels <- rep_len(labels, n)
  if (length(fill_cols) < n) fill_cols <- rep_len(fill_cols, n)

  bam_paths <- character(n)
  tmp_dirs <- character(n)

  for (i in seq_len(n)) {
    bam_src <- get_upload_path(session_id, bam_ids[i])
    bai_src <- get_upload_path(session_id, bai_ids[i])

    tmp_dir <- tempfile(pattern = "bam_track_")
    dir.create(tmp_dir, recursive = TRUE)
    tmp_dirs[i] <- tmp_dir

    bam_link <- file.path(tmp_dir, "track.bam")
    bai_link <- file.path(tmp_dir, "track.bam.bai")

    file.symlink(bam_src, bam_link)
    file.symlink(bai_src, bai_link)

    bam_paths[i] <- bam_link
  }

  names(bam_paths) <- labels

  list(paths = bam_paths, fill_cols = fill_cols, tmp_dirs = tmp_dirs)
}

cleanup_old_sessions <- function() {
  dirs <- list.dirs(UPLOAD_DIR, full.names = TRUE, recursive = FALSE)
  now <- as.numeric(Sys.time())
  for (d in dirs) {
    info <- file.info(d)
    if (!is.na(info$mtime) && (now - as.numeric(info$mtime)) > SESSION_TTL_SECS) {
      unlink(d, recursive = TRUE)
      log_info("TTL cleanup session=", basename(d))
    }
  }
}


# ── k-mer enrichment helpers ────────────────────────────────────────────────────
# kmer_enrichment() compares two sets, each of which is either a BED (built-in
# or uploaded) or a vector of gene / transcript ids. Resolve one set from the
# per-set flat params to whatever kmer_enrichment() accepts.
resolve_kmer_set <- function(req, mode, bed_source, upload_id, ids, endpoint, which) {
  if (identical(opt_str(mode), "ids")) {
    v <- opt_str(ids)
    if (is.null(v)) stop(paste0("No ids supplied for ", which, "."))
    out <- trimws(strsplit(v, "[,\\s]+")[[1]])
    out <- out[nzchar(out)]
    if (length(out) == 0L) stop(paste0("No ids supplied for ", which, "."))
    log_info(endpoint, ": ", which, " = ", length(out), " id(s)")
    return(out)
  }
  # BED mode: uploaded file wins, else built-in source, else K562 default.
  resolve_bed(req, upload_id, bed_source, paste0(endpoint, ":", which))
}

# kmer_enrichment() returns ggplots in a list; the endpoint returns JSON, so
# each plot is rendered off-screen to a PNG and inlined as a base64 data URI.
# jsonlite (already loaded by plumber) provides base64_enc, so no extra dep.
ggplot_to_data_uri <- function(plot, width = 1400, height = 900, res = 150) {
  tmp <- tempfile(fileext = ".png")
  on.exit(unlink(tmp), add = TRUE)
  grDevices::png(tmp, width = width, height = height, res = res)
  print(plot)
  grDevices::dev.off()
  raw <- readBin(tmp, "raw", n = file.info(tmp)$size)
  paste0("data:image/png;base64,", jsonlite::base64_enc(raw))
}

# The peaks pipeline returns invisible(NULL) when a request resolves to no
# renderable data (e.g. a gene with no peaks in its window). print(NULL) draws
# nothing to the device, so the png serializer then dies with the opaque
# "device output file is missing". Turn that empty result into a clear,
# user-facing message instead — the error handler serializes it as JSON and the
# frontend surfaces it verbatim.
render_plot <- function(plot, empty_msg) {
  if (is.null(plot)) stop(empty_msg)
  print(plot)
}


# ── Router config ──────────────────────────────────────────────────────────────

#* @plumber
function(pr) {
  pr$setErrorHandler(function(req, res, err) {
    # Error path: clear any per-request elapsed limit before returning so it
    # cannot leak into the later event loop (see the postroute hook below).
    setTimeLimit(cpu = Inf, elapsed = Inf)
    msg <- conditionMessage(err)
    log_error(req$REQUEST_METHOD, " ", req$PATH_INFO, " -> ", msg)
    res$status <- 500
    # Force JSON serializer — routes annotated @serializer png would otherwise
    # try to convert list(error=...) to raw bytes and crash the response pipeline.
    res$serializer <- plumber::serializer_json()
    # jsonlite::unbox ensures the string serializes as a scalar, not an array.
    list(error = jsonlite::unbox(msg))
  })

  # The `timeout` filter arms a per-request elapsed limit via setTimeLimit().
  # `transient = TRUE` is documented to reset when control returns to the R
  # top-level prompt — but plumber never returns there: it stays inside the
  # `later` event loop between requests. So a limit armed during a request
  # leaks past the handler and eventually fires while the worker is idle in
  # later::execCallbacks ("reached elapsed time limit"), halting the process.
  # Clear the limit on the success path here, after the handler has returned.
  pr$registerHooks(list(
    postroute = function() {
      setTimeLimit(cpu = Inf, elapsed = Inf)
    }
  ))
}


# ── Auth ───────────────────────────────────────────────────────────────────────

#* @filter auth
function(req, res) {
  # Bypass auth for internal health/status checks
  if (req$PATH_INFO %in% c("/health", "/status", "/favicon.ico") || startsWith(req$PATH_INFO, "/__")) {
    return(plumber::forward())
  }
  secret <- Sys.getenv("HF_SECRET_TOKEN", unset = "")
  if (nchar(secret) == 0) {
    return(plumber::forward())
  }

  auth_header <- req$HTTP_AUTHORIZATION
  if (is.null(auth_header) || !startsWith(auth_header, "Bearer ")) {
    log_error("Unauthorized from ", req$REMOTE_ADDR, " -> ", req$PATH_INFO)
    res$status <- 401
    return(list(error = "Unauthorized"))
  }
  token <- substring(auth_header, 8L) # strip "Bearer "

  # /upload accepts a short-lived HMAC upload token minted by the Next.js server.
  # Token format: "<sessionNonce>|<expiryUnixSecs>|<hmac-sha256-hex>"
  # HF recomputes the HMAC using its own copy of HF_SECRET_TOKEN and rejects
  # anything expired or tampered with.
  if (req$PATH_INFO == "/ingest") {
    parts <- strsplit(token, "\\|", fixed = FALSE)[[1]]
    if (length(parts) != 3L) {
      res$status <- 401
      return(list(error = "Unauthorized"))
    }
    nonce <- parts[1]
    expiry <- suppressWarnings(as.integer(parts[2]))
    sig <- parts[3]

    if (is.na(expiry) || as.integer(Sys.time()) > expiry) {
      res$status <- 401
      return(list(error = "Upload token expired"))
    }

    payload <- paste(nonce, parts[2], sep = "|")
    expected_sig <- digest::hmac(key = secret, object = payload, algo = "sha256", serialize = FALSE)

    if (!identical(sig, expected_sig)) {
      log_error("Invalid upload token from ", req$REMOTE_ADDR)
      res$status <- 401
      return(list(error = "Unauthorized"))
    }

    return(plumber::forward())
  }

  # All other endpoints: exact match against the static HF_SECRET_TOKEN
  if (token != secret) {
    log_error("Unauthorized from ", req$REMOTE_ADDR, " -> ", req$PATH_INFO)
    res$status <- 401
    return(list(error = "Unauthorized"))
  }
  plumber::forward()
}


# ── Session ────────────────────────────────────────────────────────────────────

#* @filter session
function(req, res) {
  bypass <- c("/health", "/status", "/favicon.ico")
  if (req$PATH_INFO %in% bypass || startsWith(req$PATH_INFO, "/__")) {
    return(plumber::forward())
  }

  sid <- req$HTTP_X_SESSION_ID
  if (is.null(sid) || !grepl("^[0-9a-f]{32}$", sid)) {
    log_error("Invalid session ID from ", req$REMOTE_ADDR, " -> ", req$PATH_INFO)
    res$status <- 400
    return(list(error = "Missing or invalid session ID."))
  }
  req$session_id <- sid
  plumber::forward()
}


# ── Request timeout ────────────────────────────────────────────────────────────
# Bound the elapsed time of analysis requests so an abandoned long job cannot
# pin a worker forever. When the limit is hit R raises "reached elapsed time
# limit", which each endpoint's tryCatch surfaces as a 500 and the worker is
# freed for the next request.
#
# NOTE: `transient = TRUE` does NOT auto-reset here — it only resets when R
# returns to the top-level prompt, and plumber stays in the `later` event loop
# between requests. The limit is therefore cleared explicitly after every
# request by the postroute hook and error handler in the @plumber block above;
# without that the leaked limit fires while the worker is idle and halts it.

#* @filter timeout
function(req) {
  bypass <- c("/health", "/status", "/favicon.ico", "/ingest")
  if (!(req$PATH_INFO %in% bypass) && !startsWith(req$PATH_INFO, "/__")) {
    setTimeLimit(elapsed = REQUEST_TIMEOUT_SECS, transient = TRUE)
  }
  plumber::forward()
}


# ── Health ─────────────────────────────────────────────────────────────────────

#* @get /health
function() {
  list(status = "ok", gtf_loaded = GTF_AVAILABLE)
}


# ── Status (admin) ─────────────────────────────────────────────────────────────

#* @get /status
function() {
  now <- as.numeric(Sys.time())

  # Count sessions: directories that exist under UPLOAD_DIR
  all_dirs <- list.dirs(UPLOAD_DIR, full.names = TRUE, recursive = FALSE)
  active_sessions <- sum(vapply(all_dirs, function(d) {
    info <- file.info(d)
    !is.na(info$mtime) && (now - as.numeric(info$mtime)) < SESSION_TTL_SECS
  }, logical(1)))

  # R GC memory (sum of Vcells column, convert to MB)
  gc_info <- gc(verbose = FALSE)
  mem_mb <- round(sum(gc_info[, 2L]), 1)

  list(
    status           = "ok",
    worker_pid       = Sys.getpid(),
    gtf_loaded       = GTF_AVAILABLE,
    uptime_secs      = as.integer(now - WORKER_START_TIME),
    active_sessions  = active_sessions,
    total_sessions   = length(all_dirs),
    r_memory_mb      = mem_mb
  )
}


# ── Upload ─────────────────────────────────────────────────────────────────────

#* @post /ingest
#* @parser multi
function(req) {
  tryCatch(
    {
      file_data <- req$body$file$value
      if (is.null(file_data) || length(file_data) == 0) {
        stop("No file received. Please select a file to upload.")
      }
      session_dir <- file.path(UPLOAD_DIR, req$session_id)
      dir.create(session_dir, recursive = TRUE, showWarnings = FALSE)

      upload_id <- uuid::UUIDgenerate()
      writeBin(file_data, file.path(session_dir, upload_id))
      log_info("Uploaded upload_id=", upload_id, " session=", req$session_id, " size=", length(file_data), "B")

      cleanup_old_sessions()
      list(upload_id = upload_id, size = length(file_data))
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("upload: ", msg)
      stop(if (grepl("No file received", msg)) {
        msg
      } else {
        "Upload failed. The file may be corrupted or in an unsupported format."
      })
    }
  )
}


# ── Delete Upload ──────────────────────────────────────────────────────────────

#* @delete /ingest/<upload_id>
function(req, upload_id) {
  valid <- tryCatch(
    {
      validate_id(upload_id, "upload ID")
      TRUE
    },
    error = function(e) FALSE
  )
  if (valid) {
    path <- file.path(UPLOAD_DIR, req$session_id, upload_id)
    if (file.exists(path)) {
      unlink(path)
      log_info("Deleted upload_id=", upload_id, " session=", req$session_id)
    }
  }
  list(status = "ok")
}


# ── Plot Gene ──────────────────────────────────────────────────────────────────

#* @post /plot-gene
#* @serializer png list(width = 1600, height = 1200, res = 150)
function(req, upload_id = NULL, bed_source = NULL,
         bed_sources = NULL, bed_upload_ids = NULL, bed_labels = NULL,
         geneID, species = "hg38", peak_col = "purple",
         order_by = "Count", five_to_three = "FALSE",
         TxID = NULL, merge = NULL, total_arrows = NULL, max_per_intron = NULL,
         gtf_upload_id = NULL, max_proteins = NULL,
         title_size = NULL, label_size = NULL, axis_breaks_n = NULL,
         show_junctions = NULL, junction_color = NULL,
         highlighted_region_start = NULL, highlighted_region_stop = NULL, highlighted_region_color = NULL,
         bam_upload_ids = NULL, bam_bai_ids = NULL, bam_labels = NULL, bam_fill_cols = NULL,
         bam_fill_alpha = NULL, bam_ylim_min = NULL, bam_ylim_max = NULL,
         bam_track_height = NULL, bam_label_size = NULL, bam_axis_text_size = NULL) {
  geneID <- toupper(geneID)
  log_info("plot-gene session=", req$session_id, " geneID=", geneID)
  tryCatch(
    {
      bed <- resolve_beds(
        req, bed_sources, bed_upload_ids, bed_labels,
        upload_id, bed_source, "plot-gene"
      )
      gtf_path <- resolve_gtf_path(req, gtf_upload_id, "plot-gene")

      # Resolve BAM coverage tracks
      bam_info <- resolve_bam(req, bam_upload_ids, bam_bai_ids, bam_labels, bam_fill_cols)
      if (!is.null(bam_info)) {
        on.exit(unlink(bam_info$tmp_dirs, recursive = TRUE), add = TRUE)
      }

      opts <- peaks_options(
        order_by     = map_order_by(order_by),
        collapse     = opt_num(merge, 0),
        max_proteins = opt_int(max_proteins, 100)
      )

      style <- peaks_plot_style(
        peak_color         = peak_col,
        total_arrows       = opt_int(total_arrows, 6),
        max_per_intron     = opt_int(max_per_intron, 2),
        title_size         = opt_num(title_size, 25),
        protein_label_size = opt_num(label_size, 4),
        axis_breaks_n      = opt_int(axis_breaks_n, 5),
        five_to_three      = isTRUE(as.logical(five_to_three)),
        show_junctions     = isTRUE(as.logical(opt_str(show_junctions, "FALSE"))),
        junction_color     = opt_str(junction_color, "gray40"),
        highlight          = resolve_highlight(highlighted_region_start, highlighted_region_stop),
        highlight_color    = opt_str(highlighted_region_color, "pink"),
        bam_fill_color     = if (!is.null(bam_info)) bam_info$fill_col else "navy",
        bam_fill_alpha     = opt_num(bam_fill_alpha, 0.75),
        bam_ylim           = resolve_bam_ylim(bam_ylim_min, bam_ylim_max),
        bam_track_height   = opt_num(bam_track_height, 0.7),
        bam_label_size     = opt_num(bam_label_size, 4),
        bam_axis_text_size = opt_num(bam_axis_text_size, 2.8)
      )

      plot <- plot_gene(
        bed        = bed,
        gene       = geneID,
        transcript = opt_txid(TxID),
        gtf        = gtf_path,
        species    = species,
        bam_files  = if (!is.null(bam_info)) bam_info$paths else NULL,
        peaks_opts = opts,
        style      = style
      )
      render_plot(plot, paste0("No peaks found for ", geneID, " in the selected region."))
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("plot-gene: ", msg)
      stop(msg)
    }
  )
}


# ── Plot Region ────────────────────────────────────────────────────────────────

#* @post /plot-region
#* @serializer png list(width = 1600, height = 1200, res = 150)
function(req, upload_id = NULL, bed_source = NULL,
         bed_sources = NULL, bed_upload_ids = NULL, bed_labels = NULL,
         Chr, Start, End, Strand, species = "hg38",
         peak_col = "purple", order_by = "Count",
         geneID = NULL, TxID = NULL, merge = NULL, total_arrows = NULL, max_per_intron = NULL,
         exon_col = NULL, utr_col = NULL, gtf_upload_id = NULL,
         max_proteins = NULL, title_size = NULL, label_size = NULL, axis_breaks_n = NULL,
         five_to_three = "FALSE", show_junctions = NULL, junction_color = NULL,
         highlighted_region_start = NULL, highlighted_region_stop = NULL, highlighted_region_color = NULL,
         bam_upload_ids = NULL, bam_bai_ids = NULL, bam_labels = NULL, bam_fill_cols = NULL,
         bam_fill_alpha = NULL, bam_ylim_min = NULL, bam_ylim_max = NULL,
         bam_track_height = NULL, bam_label_size = NULL, bam_axis_text_size = NULL) {
  log_info("plot-region session=", req$session_id, " region=", Chr, ":", Start, "-", End)
  tryCatch(
    {
      bed <- resolve_beds(
        req, bed_sources, bed_upload_ids, bed_labels,
        upload_id, bed_source, "plot-region"
      )
      gtf_path <- resolve_gtf_path(req, gtf_upload_id, "plot-region")

      bam_info <- resolve_bam(req, bam_upload_ids, bam_bai_ids, bam_labels, bam_fill_cols)
      if (!is.null(bam_info)) {
        on.exit(unlink(bam_info$tmp_dirs, recursive = TRUE), add = TRUE)
      }

      opts <- peaks_options(
        order_by     = map_order_by(order_by),
        collapse     = opt_num(merge, 0),
        max_proteins = opt_int(max_proteins, 100)
      )

      style <- peaks_plot_style(
        peak_color         = peak_col,
        exon_color         = opt_str(exon_col, "navy"),
        utr_color          = opt_str(utr_col, "lightgray"),
        total_arrows       = opt_int(total_arrows, 12),
        max_per_intron     = opt_int(max_per_intron, 5),
        title_size         = opt_num(title_size, 25),
        protein_label_size = opt_num(label_size, 4),
        axis_breaks_n      = opt_int(axis_breaks_n, 5),
        five_to_three      = isTRUE(as.logical(five_to_three)),
        show_junctions     = isTRUE(as.logical(opt_str(show_junctions, "FALSE"))),
        junction_color     = opt_str(junction_color, "gray40"),
        highlight          = resolve_highlight(highlighted_region_start, highlighted_region_stop),
        highlight_color    = opt_str(highlighted_region_color, "pink"),
        bam_fill_color     = if (!is.null(bam_info)) bam_info$fill_col else "navy",
        bam_fill_alpha     = opt_num(bam_fill_alpha, 0.75),
        bam_ylim           = resolve_bam_ylim(bam_ylim_min, bam_ylim_max),
        bam_track_height   = opt_num(bam_track_height, 0.7),
        bam_label_size     = opt_num(bam_label_size, 4),
        bam_axis_text_size = opt_num(bam_axis_text_size, 2.8)
      )

      plot <- plot_region(
        bed        = bed,
        chr        = Chr,
        start      = as.integer(Start),
        end        = as.integer(End),
        strand     = Strand,
        gtf        = gtf_path,
        species    = species,
        bam_files  = if (!is.null(bam_info)) bam_info$paths else NULL,
        peaks_opts = opts,
        style      = style
      )
      render_plot(plot, paste0("No peaks found in ", Chr, ":", Start, "-", End, " (", Strand, ")."))
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("plot-region: ", msg)
      stop(msg)
    }
  )
}


# ── Splicing Map ───────────────────────────────────────────────────────────────

#* @post /splicing-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, bed_upload_id = NULL, bed_source = NULL, mats_upload_id = NULL,
         WidthIntoExon = "50", WidthIntoIntron = "300", moving_average = "50",
         p_valueRetainedAndExclusion = NULL, p_valueControls = NULL,
         retained_IncLevelDifference = NULL, exclusion_IncLevelDifference = NULL,
         Min_Count = NULL, groups = NULL, control_multiplier = NULL, control_iterations = NULL,
         fdr_threshold = NULL,
         title = NULL, retained_col = NULL, excluded_col = NULL, control_col = NULL,
         exon_col = NULL, line_width = NULL, axis_text_size = NULL, title_size = NULL) {
  log_info("splicing-map session=", req$session_id)
  tryCatch(
    {
      bed <- resolve_bed(req, bed_upload_id, bed_source, "splicing-map")
      mats <- resolve_mats(req, mats_upload_id, "SE", "splicing-map")
      plot <- skipped_exon_splicing_map(
        events = mats,
        bed_file = bed,
        opts = build_splicing_options(
          WidthIntoExon, WidthIntoIntron, moving_average,
          p_valueRetainedAndExclusion, p_valueControls,
          retained_IncLevelDifference, exclusion_IncLevelDifference,
          Min_Count, groups, control_multiplier, control_iterations, fdr_threshold
        ),
        style = build_splicing_style(
          retained_col, excluded_col, control_col, exon_col,
          line_width, axis_text_size, title_size
        ),
        title = opt_str(title, "")
      )
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("splicing-map: ", msg)
      stop(msg)
    }
  )
}


# ── Sequence Map ───────────────────────────────────────────────────────────────

#* @post /sequence-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, mats_upload_id = NULL, sequence, genome = "hg38",
         motif_mode = "combined",
         WidthIntoExon = "50", WidthIntoIntron = "250", moving_average = "40",
         p_valueRetainedAndExclusion = NULL, p_valueControls = NULL,
         retained_IncLevelDifference = NULL, exclusion_IncLevelDifference = NULL,
         Min_Count = NULL, groups = NULL, control_multiplier = NULL, control_iterations = NULL,
         fdr_threshold = NULL,
         title = NULL, retained_col = NULL, excluded_col = NULL, control_col = NULL,
         exon_col = NULL, line_width = NULL, axis_text_size = NULL, title_size = NULL) {
  log_info("sequence-map session=", req$session_id, " sequence=", sequence, " motif_mode=", motif_mode)
  tryCatch(
    {
      mats <- resolve_mats(req, mats_upload_id, "SE", "sequence-map")
      motifs <- parse_motifs(sequence)
      plot <- skipped_exon_sequence_map(
        events = mats,
        sequence = motifs,
        genome = opt_str(genome, "hg38"),
        motif_mode = motif_mode,
        opts = build_splicing_options(
          WidthIntoExon, WidthIntoIntron, moving_average,
          p_valueRetainedAndExclusion, p_valueControls,
          retained_IncLevelDifference, exclusion_IncLevelDifference,
          Min_Count, groups, control_multiplier, control_iterations, fdr_threshold
        ),
        style = build_splicing_style(
          retained_col, excluded_col, control_col, exon_col,
          line_width, axis_text_size, title_size
        ),
        title = opt_str(title, "")
      )
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("sequence-map: ", msg)
      stop(msg)
    }
  )
}


# ── RI Splicing Map ────────────────────────────────────────────────────────────

#* @post /ri-splicing-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, bed_upload_id = NULL, bed_source = NULL, mats_upload_id = NULL,
         WidthIntoExon = "50", WidthIntoIntron = "300", moving_average = "50",
         p_valueRetainedAndExclusion = NULL, p_valueControls = NULL,
         retained_IncLevelDifference = NULL, exclusion_IncLevelDifference = NULL,
         Min_Count = NULL, groups = NULL, control_multiplier = NULL, control_iterations = NULL,
         fdr_threshold = NULL,
         title = NULL, retained_col = NULL, excluded_col = NULL, control_col = NULL,
         exon_col = NULL, line_width = NULL, axis_text_size = NULL, title_size = NULL) {
  log_info("ri-splicing-map session=", req$session_id)
  tryCatch(
    {
      bed <- resolve_bed(req, bed_upload_id, bed_source, "ri-splicing-map")
      mats <- resolve_mats(req, mats_upload_id, "RI", "ri-splicing-map")
      plot <- retained_intron_splicing_map(
        events = mats,
        bed_file = bed,
        opts = build_splicing_options(
          WidthIntoExon, WidthIntoIntron, moving_average,
          p_valueRetainedAndExclusion, p_valueControls,
          retained_IncLevelDifference, exclusion_IncLevelDifference,
          Min_Count, groups, control_multiplier, control_iterations, fdr_threshold
        ),
        style = build_splicing_style(
          retained_col, excluded_col, control_col, exon_col,
          line_width, axis_text_size, title_size
        ),
        title = opt_str(title, "")
      )
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("ri-splicing-map: ", msg)
      stop(msg)
    }
  )
}


# ── RI Sequence Map ─────────────────────────────────────────────────────────────

#* @post /ri-sequence-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, mats_upload_id = NULL, sequence, genome = "hg38",
         motif_mode = "combined",
         WidthIntoExon = "50", WidthIntoIntron = "250", moving_average = "40",
         p_valueRetainedAndExclusion = NULL, p_valueControls = NULL,
         retained_IncLevelDifference = NULL, exclusion_IncLevelDifference = NULL,
         Min_Count = NULL, groups = NULL, control_multiplier = NULL, control_iterations = NULL,
         fdr_threshold = NULL,
         title = NULL, retained_col = NULL, excluded_col = NULL, control_col = NULL,
         exon_col = NULL, line_width = NULL, axis_text_size = NULL, title_size = NULL) {
  log_info("ri-sequence-map session=", req$session_id, " sequence=", sequence, " motif_mode=", motif_mode)
  tryCatch(
    {
      mats <- resolve_mats(req, mats_upload_id, "RI", "ri-sequence-map")
      motifs <- parse_motifs(sequence)
      plot <- retained_intron_sequence_map(
        events = mats,
        sequence = motifs,
        genome = opt_str(genome, "hg38"),
        motif_mode = motif_mode,
        opts = build_splicing_options(
          WidthIntoExon, WidthIntoIntron, moving_average,
          p_valueRetainedAndExclusion, p_valueControls,
          retained_IncLevelDifference, exclusion_IncLevelDifference,
          Min_Count, groups, control_multiplier, control_iterations, fdr_threshold
        ),
        style = build_splicing_style(
          retained_col, excluded_col, control_col, exon_col,
          line_width, axis_text_size, title_size
        ),
        title = opt_str(title, "")
      )
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("ri-sequence-map: ", msg)
      stop(msg)
    }
  )
}


# ── A5SS Splicing Map ──────────────────────────────────────────────────────────

#* @post /a5ss-splicing-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, bed_upload_id = NULL, bed_source = NULL, mats_upload_id = NULL,
         WidthIntoExon = "50", WidthIntoIntron = "300", moving_average = "50",
         p_valueRetainedAndExclusion = NULL, p_valueControls = NULL,
         retained_IncLevelDifference = NULL, exclusion_IncLevelDifference = NULL,
         Min_Count = NULL, groups = NULL, control_multiplier = NULL, control_iterations = NULL,
         fdr_threshold = NULL,
         title = NULL, retained_col = NULL, excluded_col = NULL, control_col = NULL,
         exon_col = NULL, line_width = NULL, axis_text_size = NULL, title_size = NULL) {
  log_info("a5ss-splicing-map session=", req$session_id)
  tryCatch(
    {
      bed <- resolve_bed(req, bed_upload_id, bed_source, "a5ss-splicing-map")
      mats <- resolve_mats(req, mats_upload_id, "A5SS", "a5ss-splicing-map")
      plot <- five_prime_splicing_map(
        events = mats,
        bed_file = bed,
        opts = build_splicing_options(
          WidthIntoExon, WidthIntoIntron, moving_average,
          p_valueRetainedAndExclusion, p_valueControls,
          retained_IncLevelDifference, exclusion_IncLevelDifference,
          Min_Count, groups, control_multiplier, control_iterations, fdr_threshold
        ),
        style = build_splicing_style(
          retained_col, excluded_col, control_col, exon_col,
          line_width, axis_text_size, title_size
        ),
        title = opt_str(title, "")
      )
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("a5ss-splicing-map: ", msg)
      stop(msg)
    }
  )
}


# ── A5SS Sequence Map ───────────────────────────────────────────────────────────

#* @post /a5ss-sequence-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, mats_upload_id = NULL, sequence, genome = "hg38",
         motif_mode = "combined",
         WidthIntoExon = "50", WidthIntoIntron = "250", moving_average = "40",
         p_valueRetainedAndExclusion = NULL, p_valueControls = NULL,
         retained_IncLevelDifference = NULL, exclusion_IncLevelDifference = NULL,
         Min_Count = NULL, groups = NULL, control_multiplier = NULL, control_iterations = NULL,
         fdr_threshold = NULL,
         title = NULL, retained_col = NULL, excluded_col = NULL, control_col = NULL,
         exon_col = NULL, line_width = NULL, axis_text_size = NULL, title_size = NULL) {
  log_info("a5ss-sequence-map session=", req$session_id, " sequence=", sequence, " motif_mode=", motif_mode)
  tryCatch(
    {
      mats <- resolve_mats(req, mats_upload_id, "A5SS", "a5ss-sequence-map")
      motifs <- parse_motifs(sequence)
      plot <- five_prime_sequence_map(
        events = mats,
        sequence = motifs,
        genome = opt_str(genome, "hg38"),
        motif_mode = motif_mode,
        opts = build_splicing_options(
          WidthIntoExon, WidthIntoIntron, moving_average,
          p_valueRetainedAndExclusion, p_valueControls,
          retained_IncLevelDifference, exclusion_IncLevelDifference,
          Min_Count, groups, control_multiplier, control_iterations, fdr_threshold
        ),
        style = build_splicing_style(
          retained_col, excluded_col, control_col, exon_col,
          line_width, axis_text_size, title_size
        ),
        title = opt_str(title, "")
      )
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("a5ss-sequence-map: ", msg)
      stop(msg)
    }
  )
}


# ── A3SS Splicing Map ──────────────────────────────────────────────────────────

#* @post /a3ss-splicing-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, bed_upload_id = NULL, bed_source = NULL, mats_upload_id = NULL,
         WidthIntoExon = "50", WidthIntoIntron = "300", moving_average = "50",
         p_valueRetainedAndExclusion = NULL, p_valueControls = NULL,
         retained_IncLevelDifference = NULL, exclusion_IncLevelDifference = NULL,
         Min_Count = NULL, groups = NULL, control_multiplier = NULL, control_iterations = NULL,
         fdr_threshold = NULL,
         title = NULL, retained_col = NULL, excluded_col = NULL, control_col = NULL,
         exon_col = NULL, line_width = NULL, axis_text_size = NULL, title_size = NULL) {
  log_info("a3ss-splicing-map session=", req$session_id)
  tryCatch(
    {
      bed <- resolve_bed(req, bed_upload_id, bed_source, "a3ss-splicing-map")
      mats <- resolve_mats(req, mats_upload_id, "A3SS", "a3ss-splicing-map")
      plot <- three_prime_splicing_map(
        events = mats,
        bed_file = bed,
        opts = build_splicing_options(
          WidthIntoExon, WidthIntoIntron, moving_average,
          p_valueRetainedAndExclusion, p_valueControls,
          retained_IncLevelDifference, exclusion_IncLevelDifference,
          Min_Count, groups, control_multiplier, control_iterations, fdr_threshold
        ),
        style = build_splicing_style(
          retained_col, excluded_col, control_col, exon_col,
          line_width, axis_text_size, title_size
        ),
        title = opt_str(title, "")
      )
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("a3ss-splicing-map: ", msg)
      stop(msg)
    }
  )
}


# ── A3SS Sequence Map ───────────────────────────────────────────────────────────

#* @post /a3ss-sequence-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, mats_upload_id = NULL, sequence, genome = "hg38",
         motif_mode = "combined",
         WidthIntoExon = "50", WidthIntoIntron = "250", moving_average = "40",
         p_valueRetainedAndExclusion = NULL, p_valueControls = NULL,
         retained_IncLevelDifference = NULL, exclusion_IncLevelDifference = NULL,
         Min_Count = NULL, groups = NULL, control_multiplier = NULL, control_iterations = NULL,
         fdr_threshold = NULL,
         title = NULL, retained_col = NULL, excluded_col = NULL, control_col = NULL,
         exon_col = NULL, line_width = NULL, axis_text_size = NULL, title_size = NULL) {
  log_info("a3ss-sequence-map session=", req$session_id, " sequence=", sequence, " motif_mode=", motif_mode)
  tryCatch(
    {
      mats <- resolve_mats(req, mats_upload_id, "A3SS", "a3ss-sequence-map")
      motifs <- parse_motifs(sequence)
      plot <- three_prime_sequence_map(
        events = mats,
        sequence = motifs,
        genome = opt_str(genome, "hg38"),
        motif_mode = motif_mode,
        opts = build_splicing_options(
          WidthIntoExon, WidthIntoIntron, moving_average,
          p_valueRetainedAndExclusion, p_valueControls,
          retained_IncLevelDifference, exclusion_IncLevelDifference,
          Min_Count, groups, control_multiplier, control_iterations, fdr_threshold
        ),
        style = build_splicing_style(
          retained_col, excluded_col, control_col, exon_col,
          line_width, axis_text_size, title_size
        ),
        title = opt_str(title, "")
      )
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("a3ss-sequence-map: ", msg)
      stop(msg)
    }
  )
}


# ── UTR Binding ────────────────────────────────────────────────────────────────

#* @post /utr-binding
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, upload_id = NULL, bed_source = NULL,
         bed_sources = NULL, bed_upload_ids = NULL, bed_labels = NULL,
         gtf_upload_id = NULL,
         species = "hg38", transcripts = NULL, moving_average = NULL, title = NULL,
         line_width = NULL, axis_text_size = NULL, title_size = NULL,
         utr_fill = NULL, cds_fill = NULL, single_track_color = NULL,
         side = "utr5") {
  log_info("utr-binding session=", req$session_id, " species=", species, " side=", side)
  side <- match.arg(side, c("utr5", "utr3"))
  tryCatch(
    {
      bed <- resolve_beds(
        req, bed_sources, bed_upload_ids, bed_labels,
        upload_id, bed_source, "utr-binding"
      )
      gtf_path <- resolve_gtf_path(req, gtf_upload_id, "utr-binding")

      tx <- opt_str(transcripts)
      tx_vec <- if (is.null(tx)) {
        NULL
      } else {
        v <- trimws(strsplit(tx, ",")[[1]])
        v[nchar(v) > 0]
      }

      style <- utr_style(
        line_width         = opt_num(line_width, 0.8),
        axis_text_size     = opt_num(axis_text_size, 11),
        title_size         = opt_num(title_size, 20),
        utr_fill           = opt_str(utr_fill, "lightgray"),
        cds_fill           = opt_str(cds_fill, "navy"),
        single_track_color = opt_str(single_track_color, "blue")
      )

      plot <- plot_utr_binding(
        bed            = bed,
        gtf            = gtf_path,
        transcripts    = tx_vec,
        species        = species,
        moving_average = opt_int(moving_average, 5),
        style          = style,
        title          = opt_str(title, "")
      )
      # plot_utr_binding returns list(utr5 = list(plot, data), utr3 = ...);
      # render the requested side only so the client can show each separately.
      print(plot[[side]]$plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("utr-binding: ", msg)
      stop(msg)
    }
  )
}


# ── Control Peaks ──────────────────────────────────────────────────────────────
# Returns tabular data (not a plot): strand- and region-matched control peaks
# for each input peak. anno / gene / transcripts come from the bundled
# GENCODE v46 datasets.

#* @post /control-peaks
#* @serializer json
function(req, upload_id = NULL, bed_source = NULL, threads = 23, seed = NULL) {
  log_info("control-peaks session=", req$session_id)
  raw_peaks <- resolve_bed(req, upload_id, bed_source, "control-peaks")

  result <- generate_control_peaks(
    raw_peaks   = raw_peaks,
    anno        = RNAPeaks::gencode_v46_anno,
    gene        = RNAPeaks::gencode_v46_genes,
    transcripts = RNAPeaks::gencode_v46_transcripts,
    threads     = opt_int(threads, 1),
    seed        = opt_int(seed, 1234)
  )

  log_info("control-peaks: generated ", nrow(result), " control peaks")
  list(
    total   = nrow(result),
    columns = colnames(result),
    rows    = result
  )
}


# ── K-mer Enrichment ─────────────────────────────────────────────────────────────
# Compares two sets and returns MULTIPLE results in one response: a scatter
# plot, a rank plot, and an enrichment table. Because the analysis is expensive
# (GTF load + genome sequence extraction + k-mer counting for both sets) it is
# computed ONCE and everything returned together — the plots inlined as base64
# data URIs alongside the table — rather than split across per-view endpoints.

#* @post /kmer-enrichment
#* @serializer json
function(req,
         set_a_mode = "bed", set_a_bed_source = NULL, set_a_upload_id = NULL, set_a_ids = NULL,
         set_b_mode = "bed", set_b_bed_source = NULL, set_b_upload_id = NULL, set_b_ids = NULL,
         k = "4", species = "hg38", gtf_upload_id = NULL,
         label_a = NULL, label_b = NULL, top_n = NULL, title = NULL) {
  log_info("kmer-enrichment session=", req$session_id, " k=", k, " species=", species)
  tryCatch(
    {
      set_a <- resolve_kmer_set(
        req, set_a_mode, set_a_bed_source, set_a_upload_id, set_a_ids,
        "kmer-enrichment", "set_a"
      )
      set_b <- resolve_kmer_set(
        req, set_b_mode, set_b_bed_source, set_b_upload_id, set_b_ids,
        "kmer-enrichment", "set_b"
      )
      gtf_path <- resolve_gtf_path(req, gtf_upload_id, "kmer-enrichment")

      result <- kmer_enrichment(
        set_a   = set_a,
        set_b   = set_b,
        k       = as.integer(k),
        gtf     = gtf_path,
        species = species,
        label_a = opt_str(label_a, "Set A"),
        label_b = opt_str(label_b, "Set B"),
        top_n   = opt_int(top_n, 20),
        title   = opt_str(title, "")
      )

      tbl <- result$table
      log_info("kmer-enrichment: ", nrow(tbl), " k-mers")
      list(
        plots = list(
          list(
            name  = "scatter",
            label = "Scatter",
            image = ggplot_to_data_uri(result$plots$scatter)
          ),
          list(
            name  = "rank",
            label = "Rank",
            image = ggplot_to_data_uri(result$plots$rank)
          )
        ),
        table = list(
          total   = nrow(tbl),
          columns = colnames(tbl),
          rows    = tbl
        )
      )
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("kmer-enrichment: ", msg)
      stop(msg)
    }
  )
}


# ── JIT warm-up ────────────────────────────────────────────────────────────────
# Force R to compile and cache the hot code paths so the first real request
# is not penalised. Runs once at worker startup after all packages are loaded.

tryCatch(
  {
    log_info("Running JIT warm-up...")

    # ggplot2: trigger font/theme initialisation
    p <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) +
      ggplot2::geom_point()
    tmp <- tempfile(fileext = ".png")
    grDevices::png(tmp, width = 10, height = 10)
    print(p)
    grDevices::dev.off()
    unlink(tmp)

    # BSgenome: load chromosome metadata into memory
    invisible(BSgenome.Hsapiens.UCSC.hg38::BSgenome.Hsapiens.UCSC.hg38)

    log_info("JIT warm-up complete.")
  },
  error = function(e) {
    log_error("JIT warm-up failed (non-fatal): ", conditionMessage(e))
  }
)
