import { getSessionToken } from "@/lib/session"
import { friendlyError } from "@/lib/errors"

export async function deleteUpload(uploadId: string): Promise<void> {
  const sessionToken = await getSessionToken()
  await fetch(`/api/ingest/${uploadId}`, {
    method: "DELETE",
    headers: { "X-Session-Token": sessionToken },
  })
}

async function fetchPlot(
  endpoint: string,
  params: Record<string, string>
): Promise<string> {
  const sessionToken = await getSessionToken()

  // Strip empty strings so R uses its defaults
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "")
  )
  const qs = new URLSearchParams(cleaned).toString()

  const res = await fetch(`/api/${endpoint}?${qs}`, {
    method: "POST",
    headers: { "X-Session-Token": sessionToken },
  })

  if (!res.ok) {
    let serverMessage: string | undefined
    try {
      const body = await res.json()
      const raw = body.error
      serverMessage = Array.isArray(raw) ? raw[0] : raw
    } catch {
      /* ignore */
    }
    throw new Error(friendlyError(res.status, serverMessage))
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

async function fetchJson<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const sessionToken = await getSessionToken()

  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "")
  )
  const qs = new URLSearchParams(cleaned).toString()

  const res = await fetch(`/api/${endpoint}?${qs}`, {
    method: "POST",
    headers: { "X-Session-Token": sessionToken },
  })

  if (!res.ok) {
    let serverMessage: string | undefined
    try {
      const body = await res.json()
      const raw = body.error
      serverMessage = Array.isArray(raw) ? raw[0] : raw
    } catch {
      /* ignore */
    }
    throw new Error(friendlyError(res.status, serverMessage))
  }

  return res.json() as Promise<T>
}

// ── PlotGene ───────────────────────────────────────────────────────────────────

export interface PlotGeneParams {
  bedSources: string // comma-separated built-in tracks (K562,HepG2)
  bedUploadIds: string // comma-separated uploaded BED ids
  bedLabels: string // comma-separated labels for uploaded BEDs
  gtfUploadId?: string
  geneID: string
  species: string
  peakCol: string
  orderBy: string
  fiveToThree: string
  txID?: string
  merge?: string
  totalArrows?: string
  maxPerIntron?: string
  maxProteins?: string
  titleSize?: string
  labelSize?: string
  axisBreaksN?: string
  showJunctions?: string
  junctionColor?: string
  highlightStart?: string
  highlightEnd?: string
  highlightCol?: string
  // BAM coverage tracks
  bamUploadIds?: string // comma-separated upload IDs for BAM files
  bamBaiIds?: string // comma-separated upload IDs for BAI index files
  bamLabels?: string // comma-separated track labels
  bamFillCols?: string // comma-separated fill colors
  bamFillAlpha?: string
  bamYlimMin?: string
  bamYlimMax?: string
  bamTrackHeight?: string
  bamLabelSize?: string
  bamAxisTextSize?: string
}

export async function runPlotGene(params: PlotGeneParams): Promise<string> {
  return fetchPlot("plot-gene", {
    bed_sources: params.bedSources,
    bed_upload_ids: params.bedUploadIds,
    bed_labels: params.bedLabels,
    gtf_upload_id: params.gtfUploadId ?? "",
    geneID: params.geneID,
    species: params.species,
    peak_col: params.peakCol,
    order_by: params.orderBy,
    five_to_three: params.fiveToThree,
    TxID: params.txID ?? "",
    merge: params.merge ?? "",
    total_arrows: params.totalArrows ?? "",
    max_per_intron: params.maxPerIntron ?? "",
    max_proteins: params.maxProteins ?? "",
    title_size: params.titleSize ?? "",
    label_size: params.labelSize ?? "",
    axis_breaks_n: params.axisBreaksN ?? "",
    show_junctions: params.showJunctions ?? "",
    junction_color: params.junctionColor ?? "",
    highlighted_region_start: params.highlightStart ?? "",
    highlighted_region_stop: params.highlightEnd ?? "",
    highlighted_region_color: params.highlightCol ?? "",
    bam_upload_ids: params.bamUploadIds ?? "",
    bam_bai_ids: params.bamBaiIds ?? "",
    bam_labels: params.bamLabels ?? "",
    bam_fill_cols: params.bamFillCols ?? "",
    bam_fill_alpha: params.bamFillAlpha ?? "",
    bam_ylim_min: params.bamYlimMin ?? "",
    bam_ylim_max: params.bamYlimMax ?? "",
    bam_track_height: params.bamTrackHeight ?? "",
    bam_label_size: params.bamLabelSize ?? "",
    bam_axis_text_size: params.bamAxisTextSize ?? "",
  })
}

// ── PlotRegion ─────────────────────────────────────────────────────────────────

export interface PlotRegionParams {
  bedSources: string
  bedUploadIds: string
  bedLabels: string
  gtfUploadId?: string
  species?: string
  chr: string
  start: string
  end: string
  strand: string
  peakCol: string
  orderBy: string
  // Advanced
  geneID?: string
  txID?: string
  merge?: string
  totalArrows?: string
  maxPerIntron?: string
  exonCol?: string
  utrCol?: string
  maxProteins?: string
  titleSize?: string
  labelSize?: string
  axisBreaksN?: string
  fiveToThree?: string
  showJunctions?: string
  junctionColor?: string
  highlightStart?: string
  highlightEnd?: string
  highlightCol?: string
  // BAM coverage tracks
  bamUploadIds?: string
  bamBaiIds?: string
  bamLabels?: string
  bamFillCols?: string
  bamFillAlpha?: string
  bamYlimMin?: string
  bamYlimMax?: string
  bamTrackHeight?: string
  bamLabelSize?: string
  bamAxisTextSize?: string
}

export async function runPlotRegion(params: PlotRegionParams): Promise<string> {
  return fetchPlot("plot-region", {
    bed_sources: params.bedSources,
    bed_upload_ids: params.bedUploadIds,
    bed_labels: params.bedLabels,
    gtf_upload_id: params.gtfUploadId ?? "",
    species: params.species ?? "",
    Chr: params.chr,
    Start: params.start,
    End: params.end,
    Strand: params.strand,
    peak_col: params.peakCol,
    order_by: params.orderBy,
    geneID: params.geneID ?? "",
    TxID: params.txID ?? "",
    merge: params.merge ?? "",
    total_arrows: params.totalArrows ?? "",
    max_per_intron: params.maxPerIntron ?? "",
    exon_col: params.exonCol ?? "",
    utr_col: params.utrCol ?? "",
    max_proteins: params.maxProteins ?? "",
    title_size: params.titleSize ?? "",
    label_size: params.labelSize ?? "",
    axis_breaks_n: params.axisBreaksN ?? "",
    five_to_three: params.fiveToThree ?? "",
    show_junctions: params.showJunctions ?? "",
    junction_color: params.junctionColor ?? "",
    highlighted_region_start: params.highlightStart ?? "",
    highlighted_region_stop: params.highlightEnd ?? "",
    highlighted_region_color: params.highlightCol ?? "",
    bam_upload_ids: params.bamUploadIds ?? "",
    bam_bai_ids: params.bamBaiIds ?? "",
    bam_labels: params.bamLabels ?? "",
    bam_fill_cols: params.bamFillCols ?? "",
    bam_fill_alpha: params.bamFillAlpha ?? "",
    bam_ylim_min: params.bamYlimMin ?? "",
    bam_ylim_max: params.bamYlimMax ?? "",
    bam_track_height: params.bamTrackHeight ?? "",
    bam_label_size: params.bamLabelSize ?? "",
    bam_axis_text_size: params.bamAxisTextSize ?? "",
  })
}

// ── Splicing / Sequence Map shared advanced params ─────────────────────────────

export interface MapAdvancedParams {
  pValueRetainedExclusion?: string
  pValueControls?: string
  retainedIncLevelDiff?: string
  exclusionIncLevelDiff?: string
  minCount?: string
  groups?: string // comma-separated: "Retained,Excluded,Control"
  controlMultiplier?: string
  controlIterations?: string
  fdrThreshold?: string
  title?: string
  retainedCol?: string
  excludedCol?: string
  controlCol?: string
  exonCol?: string
  lineWidth?: string
  axisTextSize?: string
  titleSize?: string
}

function mapAdvancedToRecord(a: MapAdvancedParams): Record<string, string> {
  return {
    p_valueRetainedAndExclusion: a.pValueRetainedExclusion ?? "",
    p_valueControls: a.pValueControls ?? "",
    retained_IncLevelDifference: a.retainedIncLevelDiff ?? "",
    exclusion_IncLevelDifference: a.exclusionIncLevelDiff ?? "",
    Min_Count: a.minCount ?? "",
    groups: a.groups ?? "",
    control_multiplier: a.controlMultiplier ?? "",
    control_iterations: a.controlIterations ?? "",
    fdr_threshold: a.fdrThreshold ?? "",
    title: a.title ?? "",
    retained_col: a.retainedCol ?? "",
    excluded_col: a.excludedCol ?? "",
    control_col: a.controlCol ?? "",
    exon_col: a.exonCol ?? "",
    line_width: a.lineWidth ?? "",
    axis_text_size: a.axisTextSize ?? "",
    title_size: a.titleSize ?? "",
  }
}

// ── SplicingMap ────────────────────────────────────────────────────────────────

export interface SplicingMapParams extends MapAdvancedParams {
  bedUploadId: string
  bedSource?: string
  matsUploadId: string
  widthIntoExon: string
  widthIntoIntron: string
  movingAverage: string
}

export async function runSplicingMap(
  params: SplicingMapParams
): Promise<string> {
  return fetchPlot("splicing-map", {
    bed_upload_id: params.bedUploadId,
    bed_source: params.bedSource ?? "",
    mats_upload_id: params.matsUploadId,
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
    ...mapAdvancedToRecord(params),
  })
}

// ── SequenceMap ────────────────────────────────────────────────────────────────

export interface SequenceMapParams extends MapAdvancedParams {
  matsUploadId: string
  sequence: string
  motifMode?: string
  widthIntoExon: string
  widthIntoIntron: string
  movingAverage: string
}

export async function runSequenceMap(
  params: SequenceMapParams
): Promise<string> {
  return fetchPlot("sequence-map", {
    mats_upload_id: params.matsUploadId,
    sequence: params.sequence,
    motif_mode: params.motifMode ?? "combined",
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
    ...mapAdvancedToRecord(params),
  })
}

// ── RI SplicingMap ─────────────────────────────────────────────────────────────

export async function runRISplicingMap(
  params: SplicingMapParams
): Promise<string> {
  return fetchPlot("ri-splicing-map", {
    bed_upload_id: params.bedUploadId,
    bed_source: params.bedSource ?? "",
    mats_upload_id: params.matsUploadId,
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
    ...mapAdvancedToRecord(params),
  })
}

// ── RI SequenceMap ─────────────────────────────────────────────────────────────

export async function runRISequenceMap(
  params: SequenceMapParams
): Promise<string> {
  return fetchPlot("ri-sequence-map", {
    mats_upload_id: params.matsUploadId,
    sequence: params.sequence,
    motif_mode: params.motifMode ?? "combined",
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
    ...mapAdvancedToRecord(params),
  })
}

// ── A5SS SplicingMap ───────────────────────────────────────────────────────────

export async function runA5ssSplicingMap(
  params: SplicingMapParams
): Promise<string> {
  return fetchPlot("a5ss-splicing-map", {
    bed_upload_id: params.bedUploadId,
    bed_source: params.bedSource ?? "",
    mats_upload_id: params.matsUploadId,
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
    ...mapAdvancedToRecord(params),
  })
}

// ── A5SS SequenceMap ───────────────────────────────────────────────────────────

export async function runA5ssSequenceMap(
  params: SequenceMapParams
): Promise<string> {
  return fetchPlot("a5ss-sequence-map", {
    mats_upload_id: params.matsUploadId,
    sequence: params.sequence,
    motif_mode: params.motifMode ?? "combined",
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
    ...mapAdvancedToRecord(params),
  })
}

// ── A3SS SplicingMap ───────────────────────────────────────────────────────────

export async function runA3ssSplicingMap(
  params: SplicingMapParams
): Promise<string> {
  return fetchPlot("a3ss-splicing-map", {
    bed_upload_id: params.bedUploadId,
    bed_source: params.bedSource ?? "",
    mats_upload_id: params.matsUploadId,
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
    ...mapAdvancedToRecord(params),
  })
}

// ── A3SS SequenceMap ───────────────────────────────────────────────────────────

export async function runA3ssSequenceMap(
  params: SequenceMapParams
): Promise<string> {
  return fetchPlot("a3ss-sequence-map", {
    mats_upload_id: params.matsUploadId,
    sequence: params.sequence,
    motif_mode: params.motifMode ?? "combined",
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
    ...mapAdvancedToRecord(params),
  })
}

// ── UTR Binding ────────────────────────────────────────────────────────────────

export interface UtrBindingParams {
  bedSources: string
  bedUploadIds: string
  bedLabels: string
  gtfUploadId?: string
  species: string
  transcripts?: string // comma-separated transcript IDs
  movingAverage?: string
  title?: string
  lineWidth?: string
  axisTextSize?: string
  titleSize?: string
  utrFill?: string
  cdsFill?: string
  singleTrackColor?: string
  side?: "utr5" | "utr3"
}

export async function runUtrBinding(params: UtrBindingParams): Promise<string> {
  return fetchPlot("utr-binding", {
    bed_sources: params.bedSources,
    bed_upload_ids: params.bedUploadIds,
    bed_labels: params.bedLabels,
    gtf_upload_id: params.gtfUploadId ?? "",
    species: params.species,
    transcripts: params.transcripts ?? "",
    moving_average: params.movingAverage ?? "",
    title: params.title ?? "",
    line_width: params.lineWidth ?? "",
    axis_text_size: params.axisTextSize ?? "",
    title_size: params.titleSize ?? "",
    utr_fill: params.utrFill ?? "",
    cds_fill: params.cdsFill ?? "",
    single_track_color: params.singleTrackColor ?? "",
    side: params.side ?? "utr5",
  })
}

// ── Control Peaks ──────────────────────────────────────────────────────────────

export interface ControlPeaksParams {
  uploadId: string
  bedSource?: string
  threads?: string
  seed?: string
}

export interface ControlPeaksResult {
  total: number
  columns: string[]
  rows: Record<string, string | number>[]
}

export async function runControlPeaks(
  params: ControlPeaksParams
): Promise<ControlPeaksResult> {
  return fetchJson<ControlPeaksResult>("control-peaks", {
    upload_id: params.uploadId,
    bed_source: params.bedSource ?? "",
    threads: params.threads ?? "",
    seed: params.seed ?? "",
  })
}
