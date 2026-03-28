import { getSessionId } from "@/lib/session"

export async function deleteUpload(uploadId: string): Promise<void> {
  await fetch(`/api/upload/${uploadId}`, {
    method: "DELETE",
    headers: { "X-Session-ID": getSessionId() },
  })
}

async function fetchPlot(
  endpoint: string,
  params: Record<string, string>
): Promise<string> {
  const qs = new URLSearchParams(params).toString()

  const res = await fetch(`/api/${endpoint}?${qs}`, {
    method: "POST",
    headers: { "X-Session-ID": getSessionId() },
  })

  if (!res.ok) {
    const text = await res.text()
    let message = text
    try {
      message = JSON.parse(text).error ?? text
    } catch {
      /* use raw text */
    }
    throw new Error(message || `Request failed (${res.status})`)
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function runPlotGene(params: {
  uploadId: string
  geneID: string
  species: string
  peakCol: string
  orderBy: string
  fiveToThree: string
}): Promise<string> {
  return fetchPlot("plot-gene", {
    upload_id: params.uploadId,
    geneID: params.geneID,
    species: params.species,
    peak_col: params.peakCol,
    order_by: params.orderBy,
    five_to_three: params.fiveToThree,
  })
}

export async function runPlotRegion(params: {
  uploadId: string
  chr: string
  start: string
  end: string
  strand: string
  peakCol: string
  orderBy: string
}): Promise<string> {
  return fetchPlot("plot-region", {
    upload_id: params.uploadId,
    Chr: params.chr,
    Start: params.start,
    End: params.end,
    Strand: params.strand,
    peak_col: params.peakCol,
    order_by: params.orderBy,
  })
}

export async function runSplicingMap(params: {
  bedUploadId: string
  matsUploadId: string
  widthIntoExon: string
  widthIntoIntron: string
  movingAverage: string
}): Promise<string> {
  return fetchPlot("splicing-map", {
    bed_upload_id: params.bedUploadId,
    mats_upload_id: params.matsUploadId,
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
  })
}

export async function runSequenceMap(params: {
  matsUploadId: string
  sequence: string
  widthIntoExon: string
  widthIntoIntron: string
  movingAverage: string
}): Promise<string> {
  return fetchPlot("sequence-map", {
    mats_upload_id: params.matsUploadId,
    sequence: params.sequence,
    WidthIntoExon: params.widthIntoExon,
    WidthIntoIntron: params.widthIntoIntron,
    moving_average: params.movingAverage,
  })
}
