import { NextRequest, NextResponse } from "next/server"

const HF_SPACE_URL = process.env.HF_SPACE_URL
const HF_SECRET_TOKEN = process.env.HF_SECRET_TOKEN
const ADMIN_SECRET = process.env.ADMIN_SECRET

interface WorkerStatus {
  status: string
  worker_pid: number
  gtf_loaded: boolean
  uptime_secs: number
  active_sessions: number
  total_sessions: number
  r_memory_mb: number
}

async function fetchWorkerStatus(): Promise<WorkerStatus | null> {
  if (!HF_SPACE_URL) return null
  try {
    const headers: Record<string, string> = {}
    if (HF_SECRET_TOKEN) headers["Authorization"] = `Bearer ${HF_SECRET_TOKEN}`

    const res = await fetch(`${HF_SPACE_URL}/status`, {
      headers,
      // Short timeout — we're just checking liveness
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return (await res.json()) as WorkerStatus
  } catch {
    return null
  }
}

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

export async function GET(req: NextRequest) {
  if (!ADMIN_SECRET) {
    return new NextResponse(null, { status: 404 })
  }

  const cookie = req.cookies.get("rna_admin")
  if (!cookie || !(await validAdminCookie(cookie.value, ADMIN_SECRET))) {
    return new NextResponse(null, { status: 404 })
  }

  // Fire NUM_WORKERS * 2 concurrent requests so round-robin distributes them
  // across all workers. Deduplicate by PID in case some rounds hit the same worker.
  const numWorkers = Math.max(1, parseInt(process.env.NUM_WORKERS ?? "2", 10))
  const attempts = numWorkers * 2

  const results = await Promise.all(
    Array.from({ length: attempts }, () => fetchWorkerStatus())
  )

  const workerMap = new Map<number, WorkerStatus>()
  for (const r of results) {
    if (r !== null) workerMap.set(r.worker_pid, r)
  }

  const workers = Array.from(workerMap.values())

  return NextResponse.json({
    expected_workers: numWorkers,
    healthy_workers: workers.filter((w) => w.gtf_loaded).length,
    workers,
    backend_configured: !!HF_SPACE_URL,
  })
}
