import { NextRequest, NextResponse } from "next/server"

const HF_SPACE_URL = process.env.HF_SPACE_URL

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!HF_SPACE_URL) {
    return NextResponse.json({ error: "HF_SPACE_URL not configured" }, { status: 500 })
  }

  try {
    const res = await fetch(`${HF_SPACE_URL}/health`, {
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()
    return NextResponse.json({ ok: true, status: res.status, health: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
