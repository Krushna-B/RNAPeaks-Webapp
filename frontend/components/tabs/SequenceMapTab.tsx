"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileUpload } from "@/components/FileUpload"
import { PlotResult } from "@/components/PlotResult"
import { runSequenceMap } from "@/lib/api"

export function SequenceMapTab() {
  const [matsUploadId, setMatsUploadId] = useState<string | null>(null)
  const [sequence, setSequence] = useState("")
  const [widthIntoExon, setWidthIntoExon] = useState("50")
  const [widthIntoIntron, setWidthIntoIntron] = useState("250")
  const [movingAverage, setMovingAverage] = useState("40")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    if (!matsUploadId || !sequence.trim()) return
    setLoading(true)
    setError(null)
    setImageUrl(null)
    try {
      const url = await runSequenceMap({ matsUploadId, sequence: sequence.trim(), widthIntoExon, widthIntoIntron, movingAverage })
      setImageUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const canRun = !!matsUploadId && !!sequence.trim() && !loading

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
      <div className="space-y-5">
        <FileUpload
          label="SE.MATS File"
          accept=".txt,.tsv"
          onUploadComplete={(id) => setMatsUploadId(id)}
          onClear={() => setMatsUploadId(null)}
        />

        <div className="space-y-2">
          <Label htmlFor="seq">Sequence Motif</Label>
          <Input
            id="seq"
            placeholder="e.g. CCCC or YCAY"
            value={sequence}
            onChange={(e) => setSequence(e.target.value.toUpperCase())}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">Supports IUPAC ambiguity codes (Y, R, N, etc.)</p>
        </div>

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
          {loading ? "Running..." : "Run Sequence Map"}
        </Button>
      </div>

      <PlotResult imageUrl={imageUrl} loading={loading} error={error} />
    </div>
  )
}
