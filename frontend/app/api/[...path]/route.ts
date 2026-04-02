import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import logger from "@/lib/logger"

const HF_SPACE_URL = process.env.HF_SPACE_URL
const HF_SECRET_TOKEN = process.env.HF_SECRET_TOKEN
const SESSION_SECRET = process.env.SESSION_SECRET ?? ""
const TOKEN_TTL_SECS = 86400 // 24 hours — must match /api/session

async function verifySessionToken(token: string): Promise<string | null> {
  const parts = token.split("|")
  if (parts.length !== 3) return null
  const [nonce, ts, sig] = parts

  if (!/^[0-9a-f]{32}$/.test(nonce)) return null

  const timestamp = parseInt(ts, 10)
  if (isNaN(timestamp)) return null
  const age = Math.floor(Date.now() / 1000) - timestamp
  if (age < 0 || age > TOKEN_TTL_SECS) return null

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const expected = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${nonce}|${ts}`)
  )
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  if (sig !== expectedHex) return null
  return nonce
}

async function proxyRequest(
  req: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  if (!HF_SPACE_URL) {
    return NextResponse.json(
      { error: "Backend not configured" },
      { status: 503 }
    )
  }
  if (!SESSION_SECRET) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const sessionToken = req.headers.get("x-session-token")
  if (!sessionToken) {
    logger.warn("Proxy: missing session token")
    return NextResponse.json(
      { error: "Missing session token." },
      { status: 400 }
    )
  }
  const nonce = await verifySessionToken(sessionToken)
  if (!nonce) {
    logger.warn("Proxy: invalid or expired session token")
    return NextResponse.json(
      { error: "Invalid or expired session. Please refresh the page." },
      { status: 401 }
    )
  }

  const { path } = await params
  const qs = req.nextUrl.search
  const backendUrl = `${HF_SPACE_URL}/${path.join("/")}${qs}`

  const headers: Record<string, string> = {}
  if (HF_SECRET_TOKEN) headers["Authorization"] = `Bearer ${HF_SECRET_TOKEN}`

  const contentType = req.headers.get("content-type")
  if (contentType) headers["content-type"] = contentType

  headers["x-session-id"] = nonce

  const body = method !== "DELETE" ? await req.arrayBuffer() : undefined

  logger.info({ method, backendUrl }, "Proxy: forwarding request")

  let res: Response
  try {
    res = await fetch(backendUrl, { method, headers, body })
  } catch (networkErr) {
    const msg =
      networkErr instanceof Error ? networkErr.message : String(networkErr)
    Sentry.captureException(networkErr, {
      level: "error",
      extra: { method, backendUrl, sessionId: nonce },
      tags: { layer: "proxy", error_type: "network" },
    })
    logger.error(
      { method, backendUrl, err: msg },
      "Proxy: network error reaching backend"
    )
    return NextResponse.json(
      {
        error:
          "Could not reach the analysis server. It may be starting up - please try again in a moment.",
      },
      { status: 503 }
    )
  }

  if (!res.ok) {
    const errorContentType =
      res.headers.get("content-type") ?? "application/json"
    const text = await res.text()

    let parsedMessage: string | undefined
    try {
      parsedMessage = JSON.parse(text).error
    } catch {
      /* not JSON */
    }

    if (res.status >= 500) {
      Sentry.captureMessage(`Backend ${res.status} on ${path.join("/")}`, {
        level: "error",
        extra: {
          method,
          endpoint: path.join("/"),
          sessionId: nonce,
          responseBody: text.slice(0, 500),
          parsedError: parsedMessage,
        },
        tags: {
          layer: "proxy",
          error_type: "backend_5xx",
          status: String(res.status),
        },
      })
    }
    logger.error(
      { method, backendUrl, status: res.status },
      "Proxy: backend error"
    )
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": errorContentType },
    })
  }

  const responseContentType =
    res.headers.get("content-type") ?? "application/octet-stream"
  return new NextResponse(res.body, {
    status: res.status,
    headers: { "content-type": responseContentType },
  })
}

export function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, params, "POST")
}

export function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, params, "DELETE")
}
