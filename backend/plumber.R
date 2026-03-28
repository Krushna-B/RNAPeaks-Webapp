library(RNAPeaks)
library(ggplot2)

# Logging helpers
log_info <- function(...) message(format(Sys.time(), "[%Y-%m-%d %H:%M:%S]"), " [INFO]  ", ...)
log_error <- function(...) message(format(Sys.time(), "[%Y-%m-%d %H:%M:%S]"), " [ERROR] ", ...)

log_info("Loading GTF annotation...")
gtf <- tryCatch(
  LoadGTF(species = "Human"),
  error = function(e) {
    log_error("GTF load failed: ", conditionMessage(e))
    NULL
  }
)
log_info("GTF ready. gtf_loaded=", !is.null(gtf))

# Helpers
get_upload_path <- function(upload_id) {
  if (is.null(upload_id) || nchar(trimws(upload_id)) == 0) {
    stop("No upload ID provided. Please upload a file first.")
  }
  path <- file.path("/tmp/uploads", upload_id)
  if (!file.exists(path)) {
    stop("File session not found. Please upload your file again.")
  }
  path
}

# Router-level config: custom error handler so actual messages reach the client
#* @plumber
function(pr) {
  pr_set_error(pr, function(req, res, err) {
    msg <- conditionMessage(err)
    log_error(req$REQUEST_METHOD, " ", req$PATH_INFO, " -> ", msg)
    res$status <- 500
    list(error = msg)
  })
}


# CORS
# Set ALLOWED_ORIGIN env var to your frontend URL in production.
# Defaults to * (open) if not set, which is fine for local dev.
#* @filter cors
function(req, res) {
  allowed_origin <- Sys.getenv("ALLOWED_ORIGIN", unset = "*")
  res$setHeader("Access-Control-Allow-Origin", allowed_origin)
  res$setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return(list())
  }
  plumber::forward()
}


# Auth
# When HF_SECRET_TOKEN is set, every request must carry a matching Bearer token.
# In local dev without the env var set, auth is skipped entirely.
#* @filter auth
function(req, res) {
  secret <- Sys.getenv("HF_SECRET_TOKEN", unset = "")
  if (nchar(secret) == 0) return(plumber::forward())

  auth_header <- req$HTTP_AUTHORIZATION
  if (is.null(auth_header) || auth_header != paste("Bearer", secret)) {
    log_error("Unauthorized request from ", req$REMOTE_ADDR, " to ", req$PATH_INFO)
    res$status <- 401
    return(list(error = "Unauthorized"))
  }
  plumber::forward()
}


# Health
#* @get /health
function() {
  log_info("Health check")
  list(status = "ok", gtf_loaded = !is.null(gtf))
}


# Upload
#* @post /upload
#* @parser multi
function(req) {
  tryCatch(
    {
      file_data <- req$body$file$value
      if (is.null(file_data) || length(file_data) == 0) {
        stop("No file received. Please select a file to upload.")
      }
      upload_id <- paste0(
        as.integer(Sys.time()), "-",
        paste0(sample(c(letters, as.character(0:9)), 7, replace = TRUE), collapse = "")
      )
      dir.create("/tmp/uploads", recursive = TRUE, showWarnings = FALSE)
      writeBin(file_data, file.path("/tmp/uploads", upload_id))
      log_info("Uploaded file upload_id=", upload_id, " size=", length(file_data), "B")
      list(upload_id = upload_id, size = length(file_data))
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("upload: ", msg)
      user_msg <- if (grepl("No file received", msg)) {
        msg
      } else {
        "Upload failed. The file may be corrupted or in an unsupported format."
      }
      stop(user_msg)
    }
  )
}


# Delete Upload
#* @delete /upload/<upload_id>
function(upload_id) {
  path <- file.path("/tmp/uploads", upload_id)
  if (file.exists(path)) {
    unlink(path)
    log_info("Deleted upload upload_id=", upload_id)
  }
  list(status = "ok")
}


# Plot Gene
#* @post /plot-gene
#* @serializer png list(width = 1600, height = 1200, res = 150)
function(upload_id, geneID, species = "Human", peak_col = "purple",
         order_by = "Count", five_to_three = "FALSE") {
  log_info("plot-gene start upload_id=", upload_id, " geneID=", geneID, " species=", species)
  tryCatch(
    {
      path <- get_upload_path(upload_id)
      bed <- utils::read.table(path, header = FALSE, sep = "\t")
      bed <- checkBed(bed)
      result <- PlotGene(
        bed = bed, geneID = geneID, gtf = gtf, species = species,
        peak_col = peak_col, order_by = order_by,
        five_to_three = as.logical(five_to_three),
        RNA_Peaks_File_Path = NULL, Bed_File_Path = NULL
      )
      log_info("plot-gene success geneID=", geneID)
      print(result$plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("plot-gene geneID=", geneID, ": ", msg)
      user_msg <- if (grepl("File session not found|No upload ID", msg)) {
        msg
      } else if (grepl("checkBed|column|format", msg, ignore.case = TRUE)) {
        "Your BED file format is invalid. Make sure it has tab-separated columns: chr, start, end, name, score, strand."
      } else if (grepl("not found|cannot find|no peaks|zero", msg, ignore.case = TRUE)) {
        paste0("Gene '", geneID, "' was not found or has no peaks in your data. Check the gene symbol or Ensembl ID.")
      } else if (grepl("read.table|scan|parse", msg, ignore.case = TRUE)) {
        "Could not read your BED file. Make sure it is a valid tab-separated text file."
      } else {
        paste0("PlotGene failed: ", msg)
      }
      stop(user_msg)
    }
  )
}


# Plot Region
#* @post /plot-region
#* @serializer png list(width = 1600, height = 1200, res = 150)
function(upload_id, Chr, Start, End, Strand, peak_col = "blue", order_by = "Count") {
  log_info(
    "plot-region start upload_id=", upload_id,
    " region=", Chr, ":", Start, "-", End, " strand=", Strand
  )
  tryCatch(
    {
      path <- get_upload_path(upload_id)
      bed <- utils::read.table(path, header = FALSE, sep = "\t")
      bed <- checkBed(bed)
      result <- PlotRegion(
        bed = bed, gtf = gtf, Chr = Chr,
        Start = as.integer(Start), End = as.integer(End),
        Strand = Strand, peak_col = peak_col, order_by = order_by,
        RNA_Peaks_File_Path = NULL, Bed_File_Path = NULL
      )
      log_info("plot-region success region=", Chr, ":", Start, "-", End)
      print(result$plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("plot-region ", Chr, ":", Start, "-", End, ": ", msg)
      user_msg <- if (grepl("File session not found|No upload ID", msg)) {
        msg
      } else if (grepl("checkBed|column|format", msg, ignore.case = TRUE)) {
        "Your BED file format is invalid. Make sure it has tab-separated columns: chr, start, end, name, score, strand."
      } else if (grepl("no peaks|zero|empty|not found", msg, ignore.case = TRUE)) {
        paste0(
          "No peaks found in region ", Chr, ":", Start, "-", End,
          ". Try expanding the coordinates or checking the strand."
        )
      } else if (grepl("read.table|scan|parse", msg, ignore.case = TRUE)) {
        "Could not read your BED file. Make sure it is a valid tab-separated text file."
      } else {
        paste0("PlotRegion failed: ", msg)
      }
      stop(user_msg)
    }
  )
}


# Splicing Map
#* @post /splicing-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(bed_upload_id, mats_upload_id,
         WidthIntoExon = "50", WidthIntoIntron = "300", moving_average = "50") {
  log_info("splicing-map start bed=", bed_upload_id, " mats=", mats_upload_id)
  tryCatch(
    {
      bed_path <- get_upload_path(bed_upload_id)
      mats_path <- get_upload_path(mats_upload_id)
      bed <- utils::read.table(bed_path, header = FALSE, sep = "\t")
      mats <- utils::read.table(mats_path, header = TRUE, sep = "\t")
      plot <- createSplicingMap(
        bed_file = bed, SEMATS = mats,
        WidthIntoExon = as.integer(WidthIntoExon),
        WidthIntoIntron = as.integer(WidthIntoIntron),
        moving_average = as.integer(moving_average),
        verbose = FALSE
      )
      log_info("splicing-map success")
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("splicing-map: ", msg)
      user_msg <- if (grepl("File session not found|No upload ID", msg)) {
        msg
      } else if (grepl("checkBed|column|format", msg, ignore.case = TRUE)) {
        "Your BED file format is invalid. Make sure it has tab-separated columns: chr, start, end, name, score, strand."
      } else if (grepl("SE.MATS|header|column.*mats|mats.*column", msg, ignore.case = TRUE)) {
        "Your SE.MATS file appears to be invalid. Make sure it is a properly formatted rMATS output file with a header row."
      } else if (grepl("read.table|scan|parse", msg, ignore.case = TRUE)) {
        "Could not read one of your files. Make sure both files are valid tab-separated text files."
      } else {
        paste0("Splicing map failed: ", msg)
      }
      stop(user_msg)
    }
  )
}


# Sequence Map
#* @post /sequence-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(mats_upload_id, sequence,
         WidthIntoExon = "50", WidthIntoIntron = "250", moving_average = "40") {
  log_info("sequence-map start mats=", mats_upload_id, " sequence=", sequence)
  tryCatch(
    {
      path <- get_upload_path(mats_upload_id)
      mats <- utils::read.table(path, header = TRUE, sep = "\t")
      plot <- createSequenceMap(
        SEMATS = mats, sequence = sequence,
        WidthIntoExon = as.integer(WidthIntoExon),
        WidthIntoIntron = as.integer(WidthIntoIntron),
        moving_average = as.integer(moving_average),
        verbose = FALSE
      )
      log_info("sequence-map success sequence=", sequence)
      print(plot)
    },
    error = function(e) {
      msg <- conditionMessage(e)
      log_error("sequence-map sequence=", sequence, ": ", msg)
      user_msg <- if (grepl("File session not found|No upload ID", msg)) {
        msg
      } else if (grepl("SE.MATS|header|column", msg, ignore.case = TRUE)) {
        "Your SE.MATS file appears to be invalid. Make sure it is a properly formatted rMATS output file with a header row."
      } else if (grepl("sequence|motif|IUPAC|invalid.*base", msg, ignore.case = TRUE)) {
        paste0("Invalid sequence motif '", sequence, "'. Use standard nucleotide letters or IUPAC ambiguity codes (e.g. Y, R, N).")
      } else if (grepl("read.table|scan|parse", msg, ignore.case = TRUE)) {
        "Could not read your SE.MATS file. Make sure it is a valid tab-separated text file."
      } else {
        paste0("Sequence map failed: ", msg)
      }
      stop(user_msg)
    }
  )
}
