import { NextRequest, NextResponse } from "next/server"

const ADMIN_COOKIE = "rna_admin"

async function validAdminCookie(value: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("rna-admin-v1"))
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("")
  return value === expected
}

export async function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/admin")) return NextResponse.next()

  const secret = process.env.ADMIN_SECRET
  const cookie = req.cookies.get(ADMIN_COOKIE)

  if (!secret || !cookie || !(await validAdminCookie(cookie.value, secret))) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.next()
}

export const config = { matcher: ["/admin/:path*"] }
