"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface PlotResultProps {
  imageUrl: string | null
  loading: boolean
  error: string | null
}

export function PlotResult({ imageUrl, loading, error }: PlotResultProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!loading) {
      setProgress(0)
      return
    }
    setProgress(8)
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 88) return p
        const increment = Math.random() * (p < 40 ? 6 : p < 70 ? 3 : 1)
        return Math.min(p + increment, 88)
      })
    }, 700)
    return () => clearInterval(interval)
  }, [loading])

  function handleDownload() {
    if (!imageUrl) return
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = "rnapeaks-plot.png"
    a.click()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 rounded-lg border bg-muted/20 px-8">
        <div className="w-full max-w-sm space-y-3">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-center text-muted-foreground">
            Running analysis — this may take up to a minute…
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6">
        <AlertCircle className="h-8 w-8 text-destructive/70 shrink-0" />
        <p className="text-sm text-destructive text-center max-w-sm leading-relaxed">{error}</p>
      </div>
    )
  }

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg border border-dashed bg-muted/10">
        <p className="text-sm text-muted-foreground">Plot will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download PNG
        </Button>
      </div>
      <div className="rounded-lg border overflow-hidden bg-white">
        <img src={imageUrl} alt="RNAPeaks plot" className="w-full h-auto" />
      </div>
    </div>
  )
}
