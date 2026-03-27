import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import logger from "@/lib/logger"

const HF_SPACE_URL = process.env.HF_SPACE_URL
const HF_SECRET_TOKEN = process.env.HF_SECRET_TOKEN

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!HF_SPACE_URL) {
    logger.error("HF_SPACE_URL is not configured")
    return NextResponse.json(
      { error: "Backend not configured" },
      { status: 503 }
    )
  }

  const { path } = await params
  const endpoint = path.join("/")
  const backendUrl = `${HF_SPACE_URL}/${endpoint}`
  const start = Date.now()

  logger.info({ endpoint }, "backend_request_start")

  const headers: Record<string, string> = {}

  if (HF_SECRET_TOKEN) {
    headers["Authorization"] = `Bearer ${HF_SECRET_TOKEN}`
  }

  const contentType = req.headers.get("content-type")
  if (contentType) {
    headers["content-type"] = contentType
  }

  try {
    const res = await fetch(backendUrl, {
      method: "POST",
      headers,
      body: req.body,
      // @ts-expect-error required for streaming request bodies in Node
      duplex: "half",
    })

    const duration_ms = Date.now() - start

    if (!res.ok) {
      const text = await res.text()
      logger.warn({ endpoint, status: res.status, duration_ms }, "backend_request_failed")
      return new NextResponse(text, { status: res.status })
    }

    logger.info({ endpoint, status: res.status, duration_ms }, "backend_request_success")

    const responseContentType =
      res.headers.get("content-type") ?? "application/octet-stream"

    return new NextResponse(res.body, {
      status: res.status,
      headers: { "content-type": responseContentType },
    })
  } catch (err) {
    const duration_ms = Date.now() - start
    logger.error({ endpoint, duration_ms, err }, "backend_request_error")
    Sentry.captureException(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
