"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { KatssResults, KatssStatus } from "@/lib/katss"

const PREVIEW_ROWS = 100

function formatElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function statusLabel(status: KatssStatus | null): string {
  switch (status) {
    case "pending":
      return "Queued — waiting for a worker…"
    case "running":
      return "Running KATSS enrichment…"
    case "completed":
      return "Completed"
    case "failed":
      return "Failed"
    default:
      return "Submitting job…"
  }
}

// KATSS `progress` is an unspecified number; treat <= 1 as a fraction.
function normalizeProgress(p: number | null | undefined): number | null {
  if (p === null || p === undefined || Number.isNaN(p)) return null
  return p <= 1 ? Math.round(p * 100) : Math.round(p)
}

async function downloadImageAsPdf(imageUrl: string, filename: string) {
  const img = new Image()
  img.crossOrigin = "anonymous"
  img.src = imageUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
  })

  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0)
  const dataUrl = canvas.toDataURL("image/png")

  const { jsPDF } = await import("jspdf")
  const orientation = img.naturalWidth >= img.naturalHeight ? "l" : "p"
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [img.naturalWidth, img.naturalHeight],
    hotfixes: ["px_scaling"],
  })
  pdf.addImage(dataUrl, "PNG", 0, 0, img.naturalWidth, img.naturalHeight)
  pdf.save(filename)
}

function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Minimal CSV parser: handles quoted fields and escaped quotes; assumes a
// comma-separated output (KATSS writes comma-delimited result tables).
function parseCsv(text: string): { columns: string[]; rows: string[][] } {
  const parseLine = (line: string) => {
    const out: string[] = []
    let cur = ""
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"'
            i++
          } else quoted = false
        } else cur += ch
      } else if (ch === '"') quoted = true
      else if (ch === ",") {
        out.push(cur)
        cur = ""
      } else cur += ch
    }
    out.push(cur)
    return out
  }
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n")
  if (lines.length === 0) return { columns: [], rows: [] }
  return {
    columns: parseLine(lines[0]),
    rows: lines.slice(1).map(parseLine),
  }
}

type Slide =
  | { kind: "image"; label: string; url: string; filename: string }
  | { kind: "table"; label: string }
  | { kind: "stats"; label: string }

interface KatssResultProps {
  loading: boolean
  status: KatssStatus | null
  progress: number | null
  error: string | null
  results: KatssResults | null
}

export function KatssResult({
  loading,
  status,
  progress,
  error,
  results,
}: KatssResultProps) {
  const [elapsed, setElapsed] = useState(0)
  const [index, setIndex] = useState(0)
  const [prevResults, setPrevResults] = useState(results)
  const [csv, setCsv] = useState<{ columns: string[]; rows: string[][] } | null>(
    null
  )
  const [csvError, setCsvError] = useState<string | null>(null)
  const startRef = useRef<number | null>(null)

  // Build the slide list: each visualization, then the table, then the stats.
  const slides: Slide[] = []
  if (results) {
    for (const v of results.visualizations) {
      slides.push({ kind: "image", label: v.label, url: v.url, filename: v.filename })
    }
    if (results.csv_url) slides.push({ kind: "table", label: "Table" })
    if (results.summary_statistics)
      slides.push({ kind: "stats", label: "Summary" })
  }

  // Reset to the first slide whenever a new result set arrives.
  if (results !== prevResults) {
    setPrevResults(results)
    setIndex(0)
    setCsv(null)
    setCsvError(null)
  }

  // Elapsed timer while the job is in flight.
  useEffect(() => {
    if (!loading) {
      const reset = setTimeout(() => {
        setElapsed(0)
        startRef.current = null
      }, 0)
      return () => clearTimeout(reset)
    }
    startRef.current = Date.now()
    const t = setInterval(() => {
      if (startRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(t)
  }, [loading])

  // Fetch + parse the CSV once, lazily, when the table slide is first shown.
  const activeSlide = slides[index]
  useEffect(() => {
    if (!results?.csv_url || activeSlide?.kind !== "table" || csv || csvError) {
      return
    }
    let cancelled = false
    fetch(results.csv_url)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load table (${r.status})`)
        return r.text()
      })
      .then((text) => {
        if (!cancelled) setCsv(parseCsv(text))
      })
      .catch((e) => {
        if (!cancelled)
          setCsvError(e instanceof Error ? e.message : "Failed to load table")
      })
    return () => {
      cancelled = true
    }
  }, [results?.csv_url, activeSlide?.kind, csv, csvError])

  if (loading) {
    const pct = normalizeProgress(progress)
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-sm space-y-3">
          <Progress
            value={pct ?? Math.min(8 + elapsed * 1.5, 88)}
            className="h-1.5"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{statusLabel(status)}</span>
            <span className="tabular-nums">
              {pct !== null ? `${pct}% · ` : ""}
              {formatElapsed(elapsed)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6">
        <AlertCircle className="h-8 w-8 shrink-0 text-destructive/70" />
        <p className="max-w-sm text-center text-sm leading-relaxed text-destructive">
          {error}
        </p>
      </div>
    )
  }

  if (!results || slides.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-muted/10">
        <p className="text-sm text-muted-foreground">
          KATSS results will appear here
        </p>
      </div>
    )
  }

  const slide = slides[index]
  const go = (delta: number) =>
    setIndex((i) => (i + delta + slides.length) % slides.length)

  const stats = results.summary_statistics

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── Toolbar: slide nav + contextual download ── */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => go(-1)}
            disabled={slides.length < 2}
            aria-label="Previous result"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-28 text-center text-xs font-medium tabular-nums text-muted-foreground">
            {slide.label} · {index + 1}/{slides.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => go(1)}
            disabled={slides.length < 2}
            aria-label="Next result"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          {slide.kind === "image" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadUrl(slide.url, slide.filename)}
              >
                <Download className="h-3.5 w-3.5" />
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadImageAsPdf(
                    slide.url,
                    slide.filename.replace(/\.[a-z0-9]+$/i, ".pdf")
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </Button>
            </>
          )}
          {slide.kind === "table" && results.csv_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadUrl(results.csv_url!, "katss-results.csv")}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          )}
          {slide.kind === "stats" && stats && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText(
                  "katss-summary.json",
                  JSON.stringify(stats, null, 2),
                  "application/json"
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              JSON
            </Button>
          )}
        </div>
      </div>

      {/* ── Current slide ── */}
      {slide.kind === "image" && (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-white dark:bg-muted/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.url}
            alt={slide.label}
            className="h-full w-full object-contain"
          />
        </div>
      )}

      {slide.kind === "table" && (
        <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border bg-white dark:bg-muted/10">
          {csvError ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">
              {csvError}
            </div>
          ) : !csv ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Loading table…
            </div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {csv.columns.map((c, i) => (
                    <th
                      key={i}
                      className="border-b px-3 py-2 text-left font-semibold whitespace-nowrap"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csv.rows.slice(0, PREVIEW_ROWS).map((row, ri) => (
                  <tr key={ri} className="even:bg-muted/20">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-1.5 font-mono whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {slide.kind === "stats" && stats && (
        <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border bg-white dark:bg-muted/10">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {Object.entries(stats).map(([key, value]) => (
                <tr key={key} className="even:bg-muted/20">
                  <td className="border-b px-3 py-1.5 font-semibold whitespace-nowrap align-top">
                    {key}
                  </td>
                  <td className="border-b px-3 py-1.5 font-mono">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
