"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUpload } from "@/components/FileUpload"
import { PlotResult } from "@/components/PlotResult"
import { runPlotRegion } from "@/lib/api"

export function PlotRegionTab() {
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [chr, setChr] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [strand, setStrand] = useState("+")
  const [peakCol, setPeakCol] = useState("blue")
  const [orderBy, setOrderBy] = useState("Count")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    if (!uploadId || !chr || !start || !end) return
    setLoading(true)
    setError(null)
    setImageUrl(null)
    try {
      const url = await runPlotRegion({ uploadId, chr, start, end, strand, peakCol, orderBy })
      setImageUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const canRun = !!uploadId && !!chr && !!start && !!end && !loading

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
      <div className="space-y-5">
        <FileUpload
          label="BED File"
          accept=".bed"
          onUploadComplete={(id) => setUploadId(id)}
          onClear={() => setUploadId(null)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label htmlFor="chr">Chromosome</Label>
            <Input id="chr" placeholder="e.g. 1 or chrX" value={chr} onChange={(e) => setChr(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="start">Start (bp)</Label>
            <Input id="start" type="number" placeholder="56000000" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">End (bp)</Label>
            <Input id="end" type="number" placeholder="56050000" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Strand</Label>
          <Select value={strand} onValueChange={setStrand}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="+">+ (positive)</SelectItem>
              <SelectItem value="-">- (negative)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Order Tracks By</Label>
          <Select value={orderBy} onValueChange={setOrderBy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Count">Peak Count</SelectItem>
              <SelectItem value="Target">Alphabetically</SelectItem>
              <SelectItem value="Region">Genomic Region</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Peak Color</Label>
          <Select value={peakCol} onValueChange={setPeakCol}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="blue">Blue</SelectItem>
              <SelectItem value="purple">Purple</SelectItem>
              <SelectItem value="red">Red</SelectItem>
              <SelectItem value="navy">Navy</SelectItem>
              <SelectItem value="orange">Orange</SelectItem>
              <SelectItem value="darkgreen">Dark Green</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleRun} disabled={!canRun} className="w-full">
          {loading ? "Running..." : "Run PlotRegion"}
        </Button>
      </div>

      <PlotResult imageUrl={imageUrl} loading={loading} error={error} />
    </div>
  )
}
