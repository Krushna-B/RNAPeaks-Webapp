library(RNAPeaks)
library(ggplot2)

# Load GTF once at startup - shared across all requests
message("Loading GTF annotation...")
gtf <- tryCatch(
  LoadGTF(species = "Human"),
  error = function(e) {
    message("GTF load failed: ", e$message)
    NULL
  }
)
message("GTF ready.")

#* @filter cors
function(req, res) {
  ## TODO: Change to only all proper CORS res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return(list())
  }
  plumber::forward()
}

#* Health check
#* @get /health
function() {
  list(status = "ok", gtf_loaded = !is.null(gtf))
}

#* Plot RBP peaks on a single gene
#* @post /plot-gene
#* @parser multi
#* @serializer png list(width = 1600, height = 1200, res = 150)
function(req, bed_file, geneID, species = "Human", peak_col = "purple",
         order_by = "Count", five_to_three = FALSE) {
  tmp <- tempfile(fileext = ".bed")
  on.exit(unlink(tmp))

  writeBin(bed_file[[1]]$value, tmp)

  bed <- utils::read.table(tmp, header = FALSE, sep = "\t")
  bed <- checkBed(bed)

  result <- PlotGene(
    bed = bed,
    geneID = geneID,
    gtf = gtf,
    species = species,
    peak_col = peak_col,
    order_by = order_by,
    five_to_three = as.logical(five_to_three),
    RNA_Peaks_File_Path = NULL,
    Bed_File_Path = NULL
  )

  print(result$plot)
}

#* Plot RBP peaks across a genomic region
#* @post /plot-region
#* @parser multi
#* @serializer png list(width = 1600, height = 1200, res = 150)
function(req, bed_file, Chr, Start, End, Strand, peak_col = "blue",
         order_by = "Count") {
  tmp <- tempfile(fileext = ".bed")
  on.exit(unlink(tmp))

  writeBin(bed_file[[1]]$value, tmp)

  bed <- utils::read.table(tmp, header = FALSE, sep = "\t")
  bed <- checkBed(bed)

  result <- PlotRegion(
    bed = bed,
    gtf = gtf,
    Chr = Chr,
    Start = as.integer(Start),
    End = as.integer(End),
    Strand = Strand,
    peak_col = peak_col,
    order_by = order_by,
    RNA_Peaks_File_Path = NULL,
    Bed_File_Path = NULL
  )

  print(result$plot)
}

#* Compute RBP binding frequency around splice junctions
#* @post /splicing-map
#* @parser multi
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, bed_file, semats_file,
         WidthIntoExon = 50, WidthIntoIntron = 300,
         moving_average = 50, cores = 1) {
  tmp_bed <- tempfile(fileext = ".bed")
  tmp_mats <- tempfile(fileext = ".txt")
  on.exit({
    unlink(tmp_bed)
    unlink(tmp_mats)
  })

  writeBin(bed_file[[1]]$value, tmp_bed)
  writeBin(semats_file[[1]]$value, tmp_mats)

  bed <- utils::read.table(tmp_bed, header = FALSE, sep = "\t")
  mats <- utils::read.table(tmp_mats, header = TRUE, sep = "\t")

  plot <- createSplicingMap(
    bed_file = bed,
    SEMATS = mats,
    WidthIntoExon = as.integer(WidthIntoExon),
    WidthIntoIntron = as.integer(WidthIntoIntron),
    moving_average = as.integer(moving_average),
    cores = as.integer(cores),
    verbose = FALSE
  )

  print(plot)
}

#* Compute sequence motif enrichment around splice junctions
#* @post /sequence-map
#* @parser multi
#* @serializer png list(width = 1400, height = 900, res = 150)
function(req, semats_file, sequence,
         WidthIntoExon = 50, WidthIntoIntron = 250,
         moving_average = 40) {
  tmp <- tempfile(fileext = ".txt")
  on.exit(unlink(tmp))

  writeBin(semats_file[[1]]$value, tmp)

  mats <- utils::read.table(tmp, header = TRUE, sep = "\t")

  plot <- createSequenceMap(
    SEMATS          = mats,
    sequence        = sequence,
    WidthIntoExon   = as.integer(WidthIntoExon),
    WidthIntoIntron = as.integer(WidthIntoIntron),
    moving_average  = as.integer(moving_average),
    verbose         = FALSE
  )

  print(plot)
}
