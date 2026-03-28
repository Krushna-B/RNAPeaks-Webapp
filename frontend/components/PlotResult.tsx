"use client"

import { AlertCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PlotResultProps {
  imageUrl: string | null
  loading: boolean
  error: string | null
}

export function PlotResult({ imageUrl, loading, error }: PlotResultProps) {
  function handleDownload() {
    if (!imageUrl) return
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = "rnapeaks-plot.png"
    a.click()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 rounded-lg border bg-muted/20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Running analysis...</p>
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
