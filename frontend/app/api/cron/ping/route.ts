import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"

const HF_SPACE_URL = process.env.HF_SPACE_URL

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!HF_SPACE_URL) {
    Sentry.captureMessage("Health cron: HF_SPACE_URL not configured", {
      level: "error",
      tags: { layer: "cron", error_type: "misconfig" },
    })
    return NextResponse.json({ error: "HF_SPACE_URL not configured" }, { status: 500 })
  }

  try {
    const res = await fetch(`${HF_SPACE_URL}/health`, {
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()

    // A reachable-but-unhealthy backend (non-2xx health response) is just as
    // much an outage as an unreachable one — alert on it too.
    if (!res.ok) {
      Sentry.captureMessage(`Health cron: backend unhealthy (${res.status})`, {
        level: "error",
        extra: { status: res.status, health: data },
        tags: { layer: "cron", error_type: "backend_unhealthy" },
      })
    }
    return NextResponse.json({ ok: res.ok, status: res.status, health: data })
  } catch (err) {
    // The backend Space is unreachable — the exact condition this monitor exists
    // to catch. Report so it surfaces as a Sentry alert, not just a 502 body.
    const message = err instanceof Error ? err.message : "unknown error"
    Sentry.captureException(err, {
      level: "error",
      extra: { healthUrl: `${HF_SPACE_URL}/health` },
      tags: { layer: "cron", error_type: "backend_unreachable" },
    })
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
