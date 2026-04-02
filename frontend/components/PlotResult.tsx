"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

// Stage messages keyed by approximate elapsed seconds.
// The last entry applies for all remaining time.
const GENE_REGION_STAGES: [number, string][] = [
  [0, "Reading BED file…"],
  [5, "Validating genomic coordinates…"],
  [15, "Querying GTF annotation…"],
  [35, "Computing peak positions…"],
  [70, "Rendering visualization…"],
  [130, "Finalizing plot - almost there…"],
]

const MAP_STAGES: [number, string][] = [
  [0, "Reading input files…"],
  [5, "Applying statistical filters…"],
  [20, "Computing junction coverage…"],
  [60, "Smoothing with moving average…"],
  [120, "Rendering splicing map…"],
  [200, "Finalizing - almost there…"],
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

export type JobKind = "gene" | "region" | "splicing" | "sequence"

interface PlotResultProps {
  imageUrl: string | null
  loading: boolean
  error: string | null
  jobKind?: JobKind
}

export function PlotResult({
  imageUrl,
  loading,
  error,
  jobKind = "gene",
}: PlotResultProps) {
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)

  const stages =
    jobKind === "splicing" || jobKind === "sequence"
      ? MAP_STAGES
      : GENE_REGION_STAGES

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

  function handleDownload() {
    if (!imageUrl) return
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = "rnapeaks-plot.png"
    a.click()
  }

  if (loading) {
    const stage = stageLabel(elapsed, stages)
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

  if (!imageUrl) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-muted/10">
        <p className="text-sm text-muted-foreground">Plot will appear here</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 justify-end">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download PNG
        </Button>
      </div>
      {/* flex-1 + min-h-0 lets the image container shrink below its intrinsic size */}
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-lg border bg-white dark:bg-muted/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="RNAPeaks plot"
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  )
}
