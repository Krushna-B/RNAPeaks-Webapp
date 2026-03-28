import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import logger from "@/lib/logger"

const HF_SPACE_URL = process.env.HF_SPACE_URL
const HF_SECRET_TOKEN = process.env.HF_SECRET_TOKEN

async function proxyRequest(
  req: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  if (!HF_SPACE_URL) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 })
  }

  const { path } = await params
  const qs = req.nextUrl.search
  const backendUrl = `${HF_SPACE_URL}/${path.join("/")}${qs}`

  const headers: Record<string, string> = {}
  if (HF_SECRET_TOKEN) headers["Authorization"] = `Bearer ${HF_SECRET_TOKEN}`

  const contentType = req.headers.get("content-type")
  if (contentType) headers["content-type"] = contentType

  const body = method !== "DELETE" ? await req.arrayBuffer() : undefined

  const res = await fetch(backendUrl, { method, headers, body })

  if (!res.ok) {
    const errorContentType = res.headers.get("content-type") ?? "application/json"
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": errorContentType },
    })
  }

  const responseContentType = res.headers.get("content-type") ?? "application/octet-stream"
  return new NextResponse(res.body, {
    status: res.status,
    headers: { "content-type": responseContentType },
  })
}

export function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params, "POST")
}

export function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params, "DELETE")
}
