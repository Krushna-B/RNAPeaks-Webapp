import { NextRequest, NextResponse } from "next/server"

const ADMIN_COOKIE = "rna_admin"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

async function cookieValue(secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("rna-admin-v1"))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("")
}

// GET /api/admin/auth?token=YOUR_ADMIN_SECRET
// Valid  → sets HttpOnly cookie, redirects to /admin
// Invalid → 404 (no indication this endpoint exists)
export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET
  const token = req.nextUrl.searchParams.get("token")

  if (!secret || !token || token !== secret) {
    return new NextResponse(null, { status: 404 })
  }

  const value = await cookieValue(secret)
  const res = NextResponse.redirect(new URL("/admin", req.url))
  res.cookies.set(ADMIN_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
  return res
}
