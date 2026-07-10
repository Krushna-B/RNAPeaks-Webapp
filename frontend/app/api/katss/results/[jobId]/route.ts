import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { KATSS_API_URL, katssFetch } from "@/lib/katssServer"

export const runtime = "nodejs"

// A visualizations[] entry may be a bare filename or a full URL/path; reduce it
// to just the filename so we can route it back through our own download proxy.
function vizFilename(entry: string): string {
  const stripped = entry.split(/[?#]/)[0]
  const segment = stripped.split("/").filter(Boolean).pop() ?? entry
  return segment
}

// "kmer_enrichment_plot.png" -> "Kmer Enrichment Plot"
function prettify(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const url = `${KATSS_API_URL}/api/results/${encodeURIComponent(jobId)}`

  let res: Response
  try {
    res = await katssFetch(url, { cache: "no-store" }, { retries: 2, timeoutMs: 15000 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ url, err: msg }, "KATSS: results network error")
    return NextResponse.json(
      { error: "Could not reach the KATSS server." },
      { status: 503 }
    )
  }

  if (!res.ok) {
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
      },
    })
  }

  const raw = (await res.json()) as {
    job_id: string
    status: string
    output_csv_url?: string | null
    visualizations?: string[] | null
    summary_statistics?: Record<string, unknown> | null
    error_message?: string | null
  }

  const base = `/api/katss/results/${encodeURIComponent(jobId)}`
  const visualizations = (raw.visualizations ?? []).map((entry) => {
    const filename = vizFilename(entry)
    return {
      filename,
      label: prettify(filename),
      url: `${base}/viz/${encodeURIComponent(filename)}`,
    }
  })

  return NextResponse.json({
    job_id: raw.job_id,
    status: raw.status,
    csv_url: raw.output_csv_url ? `${base}/csv` : null,
    visualizations,
    summary_statistics: raw.summary_statistics ?? null,
    error_message: raw.error_message ?? null,
  })
}
