import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import {
  KATSS_API_URL,
  katssFetch,
  captureKatssBackendError,
} from "@/lib/katssServer"

// KATSS is a public, unauthenticated third-party job server. We proxy it
// server-side (rather than calling from the browser) so cross-origin fetches
// and image/CSV downloads stay same-origin — avoiding CORS and tainted-canvas
// issues when exporting visualizations to PDF.

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { error: "Invalid form submission." },
      { status: 400 }
    )
  }

  const url = `${KATSS_API_URL}/api/jobs/submit`
  logger.info({ url }, "KATSS: submitting job")

  let res: Response
  try {
    // Re-send the parsed FormData: fetch rebuilds the multipart body with a
    // fresh boundary and sets the content-type header itself. No retries — a
    // resent POST could create a duplicate job. Generous timeout for uploads.
    res = await katssFetch(
      url,
      { method: "POST", body: form },
      { retries: 0, timeoutMs: 120000 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ url, err: msg }, "KATSS: submit network error")
    return NextResponse.json(
      {
        error:
          "Could not reach the KATSS server. It may be starting up - please try again in a moment.",
      },
      { status: 503 }
    )
  }

  const text = await res.text()
  captureKatssBackendError("jobs/submit", res.status, text)
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  })
}
