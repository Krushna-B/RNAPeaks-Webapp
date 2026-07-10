import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import {
  KATSS_API_URL,
  katssFetch,
  captureKatssBackendError,
} from "@/lib/katssServer"

export const runtime = "nodejs"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; filename: string }> }
) {
  const { jobId, filename } = await params
  const url = `${KATSS_API_URL}/api/results/${encodeURIComponent(
    jobId
  )}/download/visualization/${encodeURIComponent(filename)}`

  let res: Response
  try {
    res = await katssFetch(url, { cache: "no-store" }, { retries: 2, timeoutMs: 60000 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ url, err: msg }, "KATSS: visualization download network error")
    return NextResponse.json(
      { error: "Could not reach the KATSS server." },
      { status: 503 }
    )
  }

  if (!res.ok) {
    const text = await res.text()
    captureKatssBackendError(
      `results/${jobId}/download/visualization/${filename}`,
      res.status,
      text
    )
    return new NextResponse(text, { status: res.status })
  }

  return new NextResponse(res.body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "image/png",
      // Inline so <img src> renders it; the client re-downloads for save.
      "cache-control": "private, max-age=3600",
    },
  })
}
