import { NextRequest, NextResponse } from "next/server"

const HF_SPACE_URL = process.env.HF_SPACE_URL
const HF_SECRET_TOKEN = process.env.HF_SECRET_TOKEN

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!HF_SPACE_URL) {
    return NextResponse.json(
      { error: "Backend not configured" },
      { status: 503 }
    )
  }

  const { path } = await params
  const backendUrl = `${HF_SPACE_URL}/${path.join("/")}`

  const headers: Record<string, string> = {}

  if (HF_SECRET_TOKEN) {
    headers["Authorization"] = `Bearer ${HF_SECRET_TOKEN}`
  }

  // Forward content-type so multipart boundaries are preserved
  const contentType = req.headers.get("content-type")
  if (contentType) {
    headers["content-type"] = contentType
  }

  const res = await fetch(backendUrl, {
    method: "POST",
    headers,
    body: req.body,
    // @ts-expect-error required for streaming request bodies in Node
    duplex: "half",
  })

  if (!res.ok) {
    const text = await res.text()
    return new NextResponse(text, { status: res.status })
  }

  const responseContentType =
    res.headers.get("content-type") ?? "application/octet-stream"

  return new NextResponse(res.body, {
    status: res.status,
    headers: { "content-type": responseContentType },
  })
}
