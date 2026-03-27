"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileUpload } from "@/components/FileUpload"
import { PlotResult } from "@/components/PlotResult"
import { runSplicingMap } from "@/lib/api"

export function SplicingMapTab() {
  const [bedUploadId, setBedUploadId] = useState<string | null>(null)
  const [matsUploadId, setMatsUploadId] = useState<string | null>(null)
  const [widthIntoExon, setWidthIntoExon] = useState("50")
  const [widthIntoIntron, setWidthIntoIntron] = useState("300")
  const [movingAverage, setMovingAverage] = useState("50")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    if (!bedUploadId || !matsUploadId) return
    setLoading(true)
    setError(null)
    setImageUrl(null)
    try {
      const url = await runSplicingMap({ bedUploadId, matsUploadId, widthIntoExon, widthIntoIntron, movingAverage })
      setImageUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const canRun = !!bedUploadId && !!matsUploadId && !loading

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
      <div className="space-y-5">
        <FileUpload
          label="BED File"
          accept=".bed"
          onUploadComplete={(id) => setBedUploadId(id)}
          onClear={() => setBedUploadId(null)}
        />

        <FileUpload
          label="SE.MATS File"
          accept=".txt,.tsv"
          onUploadComplete={(id) => setMatsUploadId(id)}
          onClear={() => setMatsUploadId(null)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="wExon">Width Into Exon (bp)</Label>
            <Input id="wExon" type="number" value={widthIntoExon} onChange={(e) => setWidthIntoExon(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wIntron">Width Into Intron (bp)</Label>
            <Input id="wIntron" type="number" value={widthIntoIntron} onChange={(e) => setWidthIntoIntron(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ma">Moving Average Window</Label>
          <Input id="ma" type="number" value={movingAverage} onChange={(e) => setMovingAverage(e.target.value)} />
        </div>

        <Button onClick={handleRun} disabled={!canRun} className="w-full">
          {loading ? "Running..." : "Run Splicing Map"}
        </Button>
      </div>

      <PlotResult imageUrl={imageUrl} loading={loading} error={error} />
    </div>
  )
}
