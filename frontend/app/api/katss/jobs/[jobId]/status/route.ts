import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { KATSS_API_URL, katssFetch } from "@/lib/katssServer"

export const runtime = "nodejs"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const url = `${KATSS_API_URL}/api/jobs/${encodeURIComponent(jobId)}/status`

  let res: Response
  try {
    res = await katssFetch(url, { cache: "no-store" }, { retries: 2, timeoutMs: 15000 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ url, err: msg }, "KATSS: status network error")
    return NextResponse.json(
      { error: "Could not reach the KATSS server." },
      { status: 503 }
    )
  }

  const text = await res.text()
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  })
}
