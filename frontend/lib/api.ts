import { getSessionToken } from "@/lib/session"
import { friendlyError } from "@/lib/errors"

export async function deleteUpload(uploadId: string): Promise<void> {
  const sessionToken = await getSessionToken()
  await fetch(`/api/upload/${uploadId}`, {
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
      serverMessage = (await res.json()).error
    } catch { /* ignore */ }
    throw new Error(friendlyError(res.status, serverMessage))
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

// ── PlotGene ───────────────────────────────────────────────────────────────────

export interface PlotGeneParams {
  uploadId: string
  geneID: string
  species: string
  peakCol: string
  orderBy: string
  fiveToThree: string
  // Advanced
  txID?: string
  merge?: string
  totalArrows?: string
  maxPerIntron?: string
  exonCol?: string
  utrCol?: string
  peaksWidth?: string
}

export async function runPlotGene(params: PlotGeneParams): Promise<string> {
  return fetchPlot("plot-gene", {
    upload_id: params.uploadId,
    geneID: params.geneID,
    species: params.species,
    peak_col: params.peakCol,
    order_by: params.orderBy,
    five_to_three: params.fiveToThree,
    TxID: params.txID ?? "",
    merge: params.merge ?? "",
    total_arrows: params.totalArrows ?? "",
    max_per_intron: params.maxPerIntron ?? "",
    exon_col: params.exonCol ?? "",
    utr_col: params.utrCol ?? "",
    peaks_width: params.peaksWidth ?? "",
  })
}

// ── PlotRegion ─────────────────────────────────────────────────────────────────

export interface PlotRegionParams {
  uploadId: string
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
}

export async function runPlotRegion(params: PlotRegionParams): Promise<string> {
  return fetchPlot("plot-region", {
    upload_id: params.uploadId,
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
  })
}

// ── Splicing / Sequence Map shared advanced params ─────────────────────────────

export interface MapAdvancedParams {
  pValueRetainedExclusion?: string
  pValueControls?: string
  retainedIncLevelDiff?: string
  exclusionIncLevelDiff?: string
  minCount?: string
  groups?: string        // comma-separated: "Retained,Excluded,Control"
  controlMultiplier?: string
  zThreshold?: string
  minConsecutive?: string
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
    z_threshold: a.zThreshold ?? "",
    min_consecutive: a.minConsecutive ?? "",
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
  matsUploadId: string
  widthIntoExon: string
  widthIntoIntron: string
  movingAverage: string
}

export async function runSplicingMap(params: SplicingMapParams): Promise<string> {
  return fetchPlot("splicing-map", {
    bed_upload_id: params.bedUploadId,
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
  widthIntoExon: string
  widthIntoIntron: string
  movingAverage: string
}

export async function runSequenceMap(params: SequenceMapParams): Promise<string> {
  return fetchPlot("sequence-map", {
    mats_upload_id: params.matsUploadId,
    sequence: params.sequence,
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
    ...mapAdvancedToRecord(params),
  })
}
