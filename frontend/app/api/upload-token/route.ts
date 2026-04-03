import { NextRequest, NextResponse } from "next/server"

const HF_SPACE_URL = process.env.HF_SPACE_URL
const HF_SECRET_TOKEN = process.env.HF_SECRET_TOKEN ?? ""
const SESSION_SECRET = process.env.SESSION_SECRET ?? ""
const SESSION_TTL_SECS = 86400   // must match /api/session and the catch-all proxy
const UPLOAD_TOKEN_TTL_SECS = 300 // 5 minutes — enough for any upload to start

async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// Identical to the catch-all proxy — returns the session nonce or null
async function verifySessionToken(token: string): Promise<string | null> {
  const parts = token.split("|")
  if (parts.length !== 3) return null
  const [nonce, ts, sig] = parts

  if (!/^[0-9a-f]{32}$/.test(nonce)) return null

  const timestamp = parseInt(ts, 10)
  if (isNaN(timestamp)) return null
  const age = Math.floor(Date.now() / 1000) - timestamp
  if (age < 0 || age > SESSION_TTL_SECS) return null

  const expectedHex = await hmacHex(`${nonce}|${ts}`, SESSION_SECRET)
  if (sig !== expectedHex) return null
  return nonce
}

export async function GET(req: NextRequest) {
  if (!HF_SPACE_URL) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 })
  }
  if (!SESSION_SECRET || !HF_SECRET_TOKEN) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const sessionToken = req.headers.get("x-session-token")
  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token." }, { status: 400 })
  }

  const nonce = await verifySessionToken(sessionToken)
  if (!nonce) {
    return NextResponse.json(
      { error: "Invalid or expired session. Please refresh the page." },
      { status: 401 }
    )
  }

  // Mint the upload token: HMAC(nonce|expiry, HF_SECRET_TOKEN)
  // HF recomputes this using its own copy of HF_SECRET_TOKEN to verify.
  const expiry = Math.floor(Date.now() / 1000) + UPLOAD_TOKEN_TTL_SECS
  const payload = `${nonce}|${expiry}`
  const sig = await hmacHex(payload, HF_SECRET_TOKEN)
  const uploadToken = `${payload}|${sig}`

  return NextResponse.json(
    {
      token: uploadToken,
      sessionId: nonce,
      url: `${HF_SPACE_URL}/upload`,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
