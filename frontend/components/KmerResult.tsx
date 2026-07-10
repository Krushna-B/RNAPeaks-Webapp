"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { KmerEnrichmentResult } from "@/lib/api"

const PREVIEW_ROWS = 100

// Stage messages keyed by approximate elapsed seconds; the last applies for all
// remaining time. Mirrors the pipeline order inside kmer_enrichment().
const KMER_STAGES: [number, string][] = [
  [0, "Reading input sets…"],
  [4, "Loading GTF annotation…"],
  [12, "Resolving genomic sequences…"],
  [45, "Counting k-mers…"],
  [90, "Building plots & table…"],
  [150, "Finalizing - almost there…"],
]

function stageLabel(elapsed: number, stages: [number, string][]): string {
  let label = stages[0][1]
  for (const [t, msg] of stages) {
    if (elapsed >= t) label = msg
  }
  return label
}

function formatElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

async function downloadImageAsPdf(imageUrl: string, filename: string) {
  const img = new Image()
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

function downloadImagePng(imageUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = imageUrl
  a.download = filename
  a.click()
}

function toCsv(
  columns: string[],
  rows: Record<string, string | number>[]
): string {
  const escape = (v: string | number) => {
    const s = String(v ?? "")
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.join(",")
  const body = rows
    .map((r) => columns.map((c) => escape(r[c])).join(","))
    .join("\n")
  return `${header}\n${body}\n`
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

interface KmerResultProps {
  result: KmerEnrichmentResult | null
  loading: boolean
  error: string | null
}

export function KmerResult({ result, loading, error }: KmerResultProps) {
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [index, setIndex] = useState(0)
  const [prevResult, setPrevResult] = useState(result)
  const startRef = useRef<number | null>(null)

  // Slides: one per plot, then the table as the final slide.
  const slideCount = result ? result.plots.length + 1 : 0

  // Reset to the first slide whenever a new result arrives (adjust state during
  // render rather than in an effect to avoid a cascading re-render).
  if (result !== prevResult) {
    setPrevResult(result)
    setIndex(0)
  }

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => {
        setProgress(0)
        setElapsed(0)
        startRef.current = null
      }, 0)
      return () => clearTimeout(t)
    }

    startRef.current = Date.now()
    const initTimer = setTimeout(() => setProgress(8), 0)

    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 88) return p
        const inc = Math.random() * (p < 40 ? 5 : p < 70 ? 2.5 : 0.8)
        return Math.min(p + inc, 88)
      })
    }, 700)

    const elapsedInterval = setInterval(() => {
      if (startRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }
    }, 1000)

    return () => {
      clearTimeout(initTimer)
      clearInterval(progressInterval)
      clearInterval(elapsedInterval)
    }
  }, [loading])

  if (loading) {
    const stage = stageLabel(elapsed, KMER_STAGES)
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-sm space-y-3">
          <Progress value={progress} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{stage}</span>
            <span className="tabular-nums">{formatElapsed(elapsed)}</span>
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

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-muted/10">
        <p className="text-sm text-muted-foreground">
          K-mer enrichment results will appear here
        </p>
      </div>
    )
  }

  const isTable = index === result.plots.length
  const plot = isTable ? null : result.plots[index]
  const slideLabel = isTable ? "Table" : (plot?.label ?? "")

  const go = (delta: number) =>
    setIndex((i) => (i + delta + slideCount) % slideCount)

  const { total, columns, rows } = result.table
  const preview = rows.slice(0, PREVIEW_ROWS)

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
            aria-label="Previous result"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-24 text-center text-xs font-medium tabular-nums text-muted-foreground">
            {slideLabel} · {index + 1}/{slideCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => go(1)}
            aria-label="Next result"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          {isTable ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText(
                  "kmer-enrichment.csv",
                  toCsv(columns, rows),
                  "text/csv"
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  plot &&
                  downloadImagePng(plot.image, `kmer-${plot.name}.png`)
                }
              >
                <Download className="h-3.5 w-3.5" />
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  plot &&
                  downloadImageAsPdf(plot.image, `kmer-${plot.name}.pdf`)
                }
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Current slide ── */}
      {isTable ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <p className="shrink-0 text-xs text-muted-foreground">
            {total.toLocaleString()} k-mers
            {rows.length > PREVIEW_ROWS &&
              ` · showing first ${PREVIEW_ROWS}`}
          </p>
          <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border bg-white dark:bg-muted/10">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className="border-b px-3 py-2 text-left font-semibold whitespace-nowrap"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="even:bg-muted/20">
                    {columns.map((c) => (
                      <td
                        key={c}
                        className="px-3 py-1.5 font-mono whitespace-nowrap"
                      >
                        {String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-white dark:bg-muted/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={plot!.image}
            alt={`K-mer ${plot!.label} plot`}
            className="h-full w-full object-contain"
          />
        </div>
      )}
    </div>
  )
}
