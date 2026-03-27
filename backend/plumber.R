library(RNAPeaks)
library(ggplot2)

message("Loading GTF annotation...")
gtf <- tryCatch(
  LoadGTF(species = "Human"),
  error = function(e) {
    message("GTF load failed: ", e$message)
    NULL
  }
)
message("GTF ready.")


# Helpers
assemble_chunks <- function(upload_id) {
  chunk_dir <- file.path("/tmp/uploads", upload_id)
  if (!dir.exists(chunk_dir)) stop("Upload not found: ", upload_id)
  chunk_files <- sort(list.files(chunk_dir, full.names = TRUE))
  if (length(chunk_files) == 0) stop("No chunks found for: ", upload_id)
  final_path <- tempfile()
  out_con <- file(final_path, "wb")
  tryCatch(
    for (cf in chunk_files) writeBin(readBin(cf, "raw", n = file.info(cf)$size), out_con),
    finally = close(out_con)
  )
  unlink(chunk_dir, recursive = TRUE)
  final_path
}

# CORS
#* @filter cors
function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return(list())
  }
  plumber::forward()
}

# Health
#* @get /health
function() list(status = "ok", gtf_loaded = !is.null(gtf))

# Chunk Upload
#* @post /upload/chunk
#* @parser multi
function(upload_id, chunk_index, total_chunks, chunk) {
  chunk_dir <- file.path("/tmp/uploads", upload_id)
  dir.create(chunk_dir, recursive = TRUE, showWarnings = FALSE)
  chunk_path <- file.path(chunk_dir, sprintf("chunk_%06d", as.integer(chunk_index)))
  writeBin(chunk[[1]]$value, chunk_path)
  list(status = "ok", received = as.integer(chunk_index), total = as.integer(total_chunks))
}

# Analysis endpoints
#* @post /plot-gene
#* @serializer png list(width = 1600, height = 1200, res = 150)
function(upload_id, geneID, species = "Human", peak_col = "purple",
         order_by = "Count", five_to_three = "FALSE") {
  path <- assemble_chunks(upload_id)
  on.exit(unlink(path))
  bed <- utils::read.table(path, header = FALSE, sep = "\t")
  bed <- checkBed(bed)
  result <- PlotGene(
    bed = bed, geneID = geneID, gtf = gtf, species = species,
    peak_col = peak_col, order_by = order_by,
    five_to_three = as.logical(five_to_three),
    RNA_Peaks_File_Path = NULL, Bed_File_Path = NULL
  )
  print(result$plot)
}

#* @post /plot-region
#* @serializer png list(width = 1600, height = 1200, res = 150)
function(upload_id, Chr, Start, End, Strand, peak_col = "blue", order_by = "Count") {
  path <- assemble_chunks(upload_id)
  on.exit(unlink(path))
  bed <- utils::read.table(path, header = FALSE, sep = "\t")
  bed <- checkBed(bed)
  result <- PlotRegion(
    bed = bed, gtf = gtf, Chr = Chr,
    Start = as.integer(Start), End = as.integer(End),
    Strand = Strand, peak_col = peak_col, order_by = order_by,
    RNA_Peaks_File_Path = NULL, Bed_File_Path = NULL
  )
  print(result$plot)
}

#* @post /splicing-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(bed_upload_id, mats_upload_id,
         WidthIntoExon = "50", WidthIntoIntron = "300", moving_average = "50") {
  bed_path <- assemble_chunks(bed_upload_id)
  mats_path <- assemble_chunks(mats_upload_id)
  on.exit({
    unlink(bed_path)
    unlink(mats_path)
  })
  bed <- utils::read.table(bed_path, header = FALSE, sep = "\t")
  mats <- utils::read.table(mats_path, header = TRUE, sep = "\t")
  plot <- createSplicingMap(
    bed_file = bed, SEMATS = mats,
    WidthIntoExon = as.integer(WidthIntoExon),
    WidthIntoIntron = as.integer(WidthIntoIntron),
    moving_average = as.integer(moving_average),
    verbose = FALSE
  )
  print(plot)
}

#* @post /sequence-map
#* @serializer png list(width = 1400, height = 900, res = 150)
function(mats_upload_id, sequence,
         WidthIntoExon = "50", WidthIntoIntron = "250", moving_average = "40") {
  path <- assemble_chunks(mats_upload_id)
  on.exit(unlink(path))
  mats <- utils::read.table(path, header = TRUE, sep = "\t")
  plot <- createSequenceMap(
    SEMATS = mats, sequence = sequence,
    WidthIntoExon = as.integer(WidthIntoExon),
    WidthIntoIntron = as.integer(WidthIntoIntron),
    moving_average = as.integer(moving_average),
    verbose = FALSE
  )
  print(plot)
}
