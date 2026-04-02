import { NextResponse } from "next/server"

const SESSION_SECRET = process.env.SESSION_SECRET ?? ""
const TOKEN_TTL_SECS = 86400 // 24 hours - matches proxy validation

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

export async function GET() {
  if (!SESSION_SECRET) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  const ts = Math.floor(Date.now() / 1000).toString()
  const payload = `${nonce}|${ts}`
  const sig = await hmacHex(payload, SESSION_SECRET)

  return NextResponse.json(
    { token: `${payload}|${sig}`, ttl: TOKEN_TTL_SECS },
    // No caching - each call must produce a fresh nonce
    { headers: { "Cache-Control": "no-store" } }
  )
}
