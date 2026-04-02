"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const POLL_INTERVAL_MS = 30_000

interface WorkerInfo {
  worker_pid: number
  gtf_loaded: boolean
  uptime_secs: number
  active_sessions: number
  total_sessions: number
  r_memory_mb: number
}

interface StatusResponse {
  expected_workers: number
  healthy_workers: number
  workers: WorkerInfo[]
  backend_configured: boolean
}

function formatUptime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function WorkerCard({ worker, index }: { worker: WorkerInfo; index: number }) {
  const healthy = worker.gtf_loaded
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Worker {index + 1}</span>
        <Badge variant={healthy ? "default" : "destructive"} className="text-xs">
          {healthy ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
          {healthy ? "healthy" : "degraded"}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">PID</dt>
        <dd className="font-mono">{worker.worker_pid}</dd>
        <dt className="text-muted-foreground">Uptime</dt>
        <dd>{formatUptime(worker.uptime_secs)}</dd>
        <dt className="text-muted-foreground">Active sessions</dt>
        <dd>{worker.active_sessions}</dd>
        <dt className="text-muted-foreground">Total sessions</dt>
        <dd>{worker.total_sessions}</dd>
        <dt className="text-muted-foreground">R memory</dt>
        <dd>{worker.r_memory_mb} MB</dd>
        <dt className="text-muted-foreground">GTF loaded</dt>
        <dd>{worker.gtf_loaded ? "Yes" : "No"}</dd>
      </dl>
    </div>
  )
}

export default function AdminPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Cookie is sent automatically by the browser
      const res = await fetch("/api/admin/status")
      if (!res.ok) {
        setError("Failed to fetch status.")
        return
      }
      setStatus(await res.json())
      setLastRefresh(new Date())
    } catch {
      setError("Could not reach the admin API.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStatus])

  const allHealthy = status !== null && status.healthy_workers === status.expected_workers
  const someDown   = status !== null && status.healthy_workers < status.expected_workers

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">RNAPeaks Admin</h1>
          {lastRefresh && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last updated {lastRefresh.toLocaleTimeString()} · auto-refresh every 30s
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-8">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {status && (
          <>
            <div className={`rounded-lg border p-4 flex items-center gap-3 ${
              allHealthy ? "border-green-200 bg-green-50"
              : someDown  ? "border-yellow-200 bg-yellow-50"
              : "border-destructive/30 bg-destructive/5"
            }`}>
              {allHealthy
                ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                : <AlertCircle  className="h-5 w-5 text-yellow-600 shrink-0" />}
              <div>
                <p className="text-sm font-medium">
                  {allHealthy
                    ? "All workers healthy"
                    : `${status.healthy_workers} / ${status.expected_workers} workers healthy`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {status.expected_workers} worker{status.expected_workers !== 1 ? "s" : ""} configured ·{" "}
                  {status.workers.reduce((s, w) => s + w.active_sessions, 0)} active session
                  {status.workers.reduce((s, w) => s + w.active_sessions, 0) !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Workers</h2>
              {status.workers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workers responded — backend may still be starting.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {status.workers.map((w, i) => <WorkerCard key={w.worker_pid} worker={w} index={i} />)}
                </div>
              )}
              {status.workers.length < status.expected_workers && (
                <p className="text-xs text-muted-foreground">
                  {status.expected_workers - status.workers.length} worker
                  {status.expected_workers - status.workers.length !== 1 ? "s" : ""} did not respond — may be starting or crashed.
                </p>
              )}
            </section>
          </>
        )}

        {loading && !status && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </main>
    </div>
  )
}
