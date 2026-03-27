"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUpload } from "@/components/FileUpload"
import { PlotResult } from "@/components/PlotResult"
import { runPlotGene } from "@/lib/api"

export function PlotGeneTab() {
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [geneID, setGeneID] = useState("")
  const [species, setSpecies] = useState("Human")
  const [peakCol, setPeakCol] = useState("purple")
  const [orderBy, setOrderBy] = useState("Count")
  const [fiveToThree, setFiveToThree] = useState("FALSE")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    if (!uploadId || !geneID.trim()) return
    setLoading(true)
    setError(null)
    setImageUrl(null)
    try {
      const url = await runPlotGene({ uploadId, geneID: geneID.trim(), species, peakCol, orderBy, fiveToThree })
      setImageUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const canRun = !!uploadId && !!geneID.trim() && !loading

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
      <div className="space-y-5">
        <FileUpload
          label="BED File"
          accept=".bed"
          onUploadComplete={(id) => setUploadId(id)}
          onClear={() => setUploadId(null)}
        />

        <div className="space-y-2">
          <Label htmlFor="geneID">Gene ID</Label>
          <Input
            id="geneID"
            placeholder="e.g. GAPDH or ENSG00000111640"
            value={geneID}
            onChange={(e) => setGeneID(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Species</Label>
          <Select value={species} onValueChange={setSpecies}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Human">Human</SelectItem>
              <SelectItem value="Mouse">Mouse</SelectItem>
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
              <SelectItem value="purple">Purple</SelectItem>
              <SelectItem value="blue">Blue</SelectItem>
              <SelectItem value="red">Red</SelectItem>
              <SelectItem value="navy">Navy</SelectItem>
              <SelectItem value="orange">Orange</SelectItem>
              <SelectItem value="darkgreen">Dark Green</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Orientation</Label>
          <Select value={fiveToThree} onValueChange={setFiveToThree}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FALSE">Genomic coordinates</SelectItem>
              <SelectItem value="TRUE">5′ → 3′</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleRun} disabled={!canRun} className="w-full">
          {loading ? "Running..." : "Run PlotGene"}
        </Button>
      </div>

      <PlotResult imageUrl={imageUrl} loading={loading} error={error} />
    </div>
  )
}
