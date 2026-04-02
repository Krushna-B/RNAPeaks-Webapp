suppressPackageStartupMessages({
  library(RNAPeaks)
  library(ggplot2)
  library(uuid)
  library(BSgenome.Hsapiens.UCSC.hg38)
})

UPLOAD_DIR <- Sys.getenv("UPLOAD_DIR", unset = "/tmp/uploads")
SESSION_TTL_SECS <- 900L # 15 minutes

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
  if (is.null(v)) c("Retained", "Excluded", "Control") else strsplit(v, ",")[[1]]
}
opt_txid <- function(x) {
  v <- opt_str(x)
  if (is.null(v) || v == "NA") NA else v
}

log_info <- function(...) message(format(Sys.time(), "[%Y-%m-%d %H:%M:%S]"), " [INFO]  ", ...)
log_error <- function(...) message(format(Sys.time(), "[%Y-%m-%d %H:%M:%S]"), " [ERROR] ", ...)

WORKER_START_TIME <- as.numeric(Sys.time())

log_info("Loading GTF annotations...")
gtf <- tryCatch(
  LoadGTF(species = "Human"),
  error = function(e) {
    log_error("Human GTF load failed: ", conditionMessage(e))
    NULL
  }
)
gtf_mouse <- tryCatch(
  LoadGTF(species = "Mouse"),
  error = function(e) {
    log_error("Mouse GTF load failed: ", conditionMessage(e))
    NULL
  }
)
log_info("GTF ready. human=", !is.null(gtf), " mouse=", !is.null(gtf_mouse))


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


# ── Router config ──────────────────────────────────────────────────────────────

#* @plumber
function(pr) {
  pr$setErrorHandler(function(req, res, err) {
    msg <- conditionMessage(err)
    log_error(req$REQUEST_METHOD, " ", req$PATH_INFO, " -> ", msg)
    res$status <- 500
    # Force JSON serializer — routes annotated @serializer png would otherwise
    # try to convert list(error=...) to raw bytes and crash the response pipeline.
    res$serializer <- plumber::serializer_json()
    list(error = msg)
  })
}


# ── CORS ───────────────────────────────────────────────────────────────────────

#* @filter cors
function(req, res) {
  allowed_origin <- Sys.getenv("ALLOWED_ORIGIN", unset = "*")
  res$setHeader("Access-Control-Allow-Origin", allowed_origin)
  res$setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Session-ID")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return(list())
  }
  plumber::forward()
}


# ── Auth ───────────────────────────────────────────────────────────────────────

#* @filter auth
function(req, res) {
  secret <- Sys.getenv("HF_SECRET_TOKEN", unset = "")
  if (nchar(secret) == 0) {
    return(plumber::forward())
  }

  auth_header <- req$HTTP_AUTHORIZATION
  if (is.null(auth_header) || auth_header != paste("Bearer", secret)) {
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


# ── Health ─────────────────────────────────────────────────────────────────────

#* @get /health
function() {
  list(status = "ok", gtf_loaded = !is.null(gtf))
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
    gtf_loaded       = !is.null(gtf),
    uptime_secs      = as.integer(now - WORKER_START_TIME),
    active_sessions  = active_sessions,
    total_sessions   = length(all_dirs),
    r_memory_mb      = mem_mb
  )
}


# ── Upload ─────────────────────────────────────────────────────────────────────

#* @post /upload
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

#* @delete /upload/<upload_id>
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
function(req, upload_id, geneID, species = "Human", peak_col = "purple",
         order_by = "Count", five_to_three = "FALSE",
         TxID = NULL, merge = NULL, total_arrows = NULL, max_per_intron = NULL,
         exon_col = NULL, utr_col = NULL, peaks_width = NULL) {
  log_info("plot-gene session=", req$session_id, " geneID=", geneID)
  tryCatch(
    {
      path <- get_upload_path(req$session_id, upload_id)
      bed <- utils::read.table(path, header = FALSE, sep = "\t")
      bed <- checkBed(bed)
      active_gtf <- if (species == "Mouse") gtf_mouse else gtf
      result <- PlotGene(
        bed = bed, geneID = geneID, gtf = active_gtf, species = species,
        TxID = opt_txid(TxID),
        merge = opt_int(merge, 0),
        peak_col = peak_col, order_by = order_by,
        five_to_three = as.logical(five_to_three),
        total_arrows = opt_int(total_arrows, 6),
        max_per_intron = opt_int(max_per_intron, 2),
        exon_col = opt_str(exon_col, "black"),
        utr_col = opt_str(utr_col, "dark gray"),
        peaks_width = opt_num(peaks_width, 0.3),
        RNA_Peaks_File_Path = NULL, Bed_File_Path = NULL
      )
      print(result$plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("plot-gene: ", msg)
      stop(if (grepl("File session not found|No upload ID|Invalid", msg)) {
        msg
      } else if (grepl("checkBed|column|format", msg, ignore.case = TRUE)) {
        "Your BED file format is invalid. Make sure it has tab-separated columns: chr, start, end, name, score, strand."
      } else if (grepl("not found|cannot find|no peaks|zero", msg, ignore.case = TRUE)) {
        paste0("Gene '", geneID, "' was not found or has no peaks in your data. Check the gene symbol or Ensembl ID.")
      } else if (grepl("read.table|scan|parse", msg, ignore.case = TRUE)) {
        "Could not read your BED file. Make sure it is a valid tab-separated text file."
      } else {
        paste0("PlotGene failed: ", msg)
      })
    }
  )
}


# ── Plot Region ────────────────────────────────────────────────────────────────

#* @post /plot-region
#* @serializer png list(width = 1600, height = 1200, res = 150)
function(req, upload_id, Chr, Start, End, Strand, species = "Human",
         peak_col = "blue", order_by = "Count",
         geneID = NULL, TxID = NULL, merge = NULL, total_arrows = NULL, max_per_intron = NULL,
         exon_col = NULL, utr_col = NULL) {
  log_info("plot-region session=", req$session_id, " region=", Chr, ":", Start, "-", End)
  tryCatch(
    {
      path <- get_upload_path(req$session_id, upload_id)
      bed <- utils::read.table(path, header = FALSE, sep = "\t")
      bed <- checkBed(bed)
      active_gtf <- if (species == "Mouse") gtf_mouse else gtf
      result <- PlotRegion(
        bed = bed, gtf = active_gtf, Chr = Chr,
        Start = as.integer(Start), End = as.integer(End),
        Strand = Strand,
        geneID = opt_str(geneID, NULL),
        TxID = opt_txid(TxID),
        merge = opt_int(merge, 0),
        peak_col = peak_col, order_by = order_by,
        total_arrows = opt_int(total_arrows, 12),
        max_per_intron = opt_int(max_per_intron, 5),
        exon_col = opt_str(exon_col, "black"),
        utr_col = opt_str(utr_col, "dark gray"),
        RNA_Peaks_File_Path = NULL, Bed_File_Path = NULL
      )
      print(result$plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("plot-region: ", msg)
      stop(if (grepl("File session not found|No upload ID|Invalid", msg)) {
        msg
      } else if (grepl("checkBed|column|format", msg, ignore.case = TRUE)) {
        "Your BED file format is invalid. Make sure it has tab-separated columns: chr, start, end, name, score, strand."
      } else if (grepl("no peaks|zero|empty|not found", msg, ignore.case = TRUE)) {
        paste0("No peaks found in region ", Chr, ":", Start, "-", End, ". Try expanding the coordinates or checking the strand.")
      } else if (grepl("read.table|scan|parse", msg, ignore.case = TRUE)) {
        "Could not read your BED file. Make sure it is a valid tab-separated text file."
      } else {
        paste0("PlotRegion failed: ", msg)
      })
    }
  )
}


# ── Splicing Map ───────────────────────────────────────────────────────────────

#* @post /splicing-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, bed_upload_id, mats_upload_id,
         WidthIntoExon = "50", WidthIntoIntron = "300", moving_average = "50",
         p_valueRetainedAndExclusion = NULL, p_valueControls = NULL,
         retained_IncLevelDifference = NULL, exclusion_IncLevelDifference = NULL,
         Min_Count = NULL, groups = NULL, control_multiplier = NULL,
         z_threshold = NULL, min_consecutive = NULL,
         title = NULL, retained_col = NULL, excluded_col = NULL, control_col = NULL,
         exon_col = NULL, line_width = NULL, axis_text_size = NULL, title_size = NULL) {
  log_info("splicing-map session=", req$session_id)
  tryCatch(
    {
      bed_path <- get_upload_path(req$session_id, bed_upload_id)
      mats_path <- get_upload_path(req$session_id, mats_upload_id)
      bed <- utils::read.table(bed_path, header = FALSE, sep = "\t")
      mats <- utils::read.table(mats_path, header = TRUE, sep = "\t")
      plot <- createSplicingMap(
        bed_file = bed, SEMATS = mats,
        WidthIntoExon = as.integer(WidthIntoExon),
        WidthIntoIntron = as.integer(WidthIntoIntron),
        moving_average = as.integer(moving_average),
        p_valueRetainedAndExclusion = opt_num(p_valueRetainedAndExclusion, 0.05),
        p_valueControls = opt_num(p_valueControls, 0.95),
        retained_IncLevelDifference = opt_num(retained_IncLevelDifference, 0.1),
        exclusion_IncLevelDifference = opt_num(exclusion_IncLevelDifference, -0.1),
        Min_Count = opt_int(Min_Count, 50),
        groups = opt_groups(groups),
        control_multiplier = opt_num(control_multiplier, 2.0),
        z_threshold = opt_num(z_threshold, 1.96),
        min_consecutive = opt_int(min_consecutive, 10),
        title = opt_str(title, ""),
        retained_col = opt_str(retained_col, "blue"),
        excluded_col = opt_str(excluded_col, "red"),
        control_col = opt_str(control_col, "black"),
        exon_col = opt_str(exon_col, "navy"),
        line_width = opt_num(line_width, 0.8),
        axis_text_size = opt_num(axis_text_size, 11),
        title_size = opt_num(title_size, 20),
        cores = 1L, verbose = FALSE
      )
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("splicing-map: ", msg)
      stop(if (grepl("File session not found|No upload ID|Invalid", msg)) {
        msg
      } else if (grepl("checkBed|column|format", msg, ignore.case = TRUE)) {
        "Your BED file format is invalid. Make sure it has tab-separated columns: chr, start, end, name, score, strand."
      } else if (grepl("SE.MATS|header|column.*mats|mats.*column", msg, ignore.case = TRUE)) {
        "Your SE.MATS file appears to be invalid. Make sure it is a properly formatted rMATS output file with a header row."
      } else if (grepl("read.table|scan|parse", msg, ignore.case = TRUE)) {
        "Could not read one of your files. Make sure both files are valid tab-separated text files."
      } else {
        paste0("Splicing map failed: ", msg)
      })
    }
  )
}


# ── Sequence Map ───────────────────────────────────────────────────────────────

#* @post /sequence-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, mats_upload_id, sequence,
         WidthIntoExon = "50", WidthIntoIntron = "250", moving_average = "40",
         p_valueRetainedAndExclusion = NULL, p_valueControls = NULL,
         retained_IncLevelDifference = NULL, exclusion_IncLevelDifference = NULL,
         Min_Count = NULL, groups = NULL, control_multiplier = NULL,
         z_threshold = NULL, min_consecutive = NULL,
         title = NULL, retained_col = NULL, excluded_col = NULL, control_col = NULL,
         exon_col = NULL, line_width = NULL, axis_text_size = NULL, title_size = NULL) {
  log_info("sequence-map session=", req$session_id, " sequence=", sequence)
  tryCatch(
    {
      path <- get_upload_path(req$session_id, mats_upload_id)
      mats <- utils::read.table(path, header = TRUE, sep = "\t")
      plot <- createSequenceMap(
        SEMATS = mats, sequence = sequence,
        WidthIntoExon = as.integer(WidthIntoExon),
        WidthIntoIntron = as.integer(WidthIntoIntron),
        moving_average = as.integer(moving_average),
        p_valueRetainedAndExclusion = opt_num(p_valueRetainedAndExclusion, 0.05),
        p_valueControls = opt_num(p_valueControls, 0.95),
        retained_IncLevelDifference = opt_num(retained_IncLevelDifference, 0.1),
        exclusion_IncLevelDifference = opt_num(exclusion_IncLevelDifference, -0.1),
        Min_Count = opt_int(Min_Count, 50),
        groups = opt_groups(groups),
        control_multiplier = opt_num(control_multiplier, 2.0),
        z_threshold = opt_num(z_threshold, 1.96),
        min_consecutive = opt_int(min_consecutive, 10),
        title = opt_str(title, ""),
        retained_col = opt_str(retained_col, "blue"),
        excluded_col = opt_str(excluded_col, "red"),
        control_col = opt_str(control_col, "black"),
        exon_col = opt_str(exon_col, "navy"),
        line_width = opt_num(line_width, 0.8),
        axis_text_size = opt_num(axis_text_size, 11),
        title_size = opt_num(title_size, 20),
        cores = 1L, verbose = FALSE
      )
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("sequence-map: ", msg)
      stop(if (grepl("File session not found|No upload ID|Invalid", msg)) {
        msg
      } else if (grepl("SE.MATS|header|column", msg, ignore.case = TRUE)) {
        "Your SE.MATS file appears to be invalid. Make sure it is a properly formatted rMATS output file with a header row."
      } else if (grepl("sequence|motif|IUPAC|invalid.*base", msg, ignore.case = TRUE)) {
        paste0("Invalid sequence motif '", sequence, "'. Use standard nucleotide letters or IUPAC ambiguity codes (e.g. Y, R, N).")
      } else if (grepl("read.table|scan|parse", msg, ignore.case = TRUE)) {
        "Could not read your SE.MATS file. Make sure it is a valid tab-separated text file."
      } else {
        paste0("Sequence map failed: ", msg)
      })
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
