"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileUpload } from "@/components/FileUpload"
import { PlotResult } from "@/components/PlotResult"
import { runPlotGene } from "@/lib/api"

const COLOR_OPTIONS = [
  { value: "purple", label: "Purple" },
  { value: "blue", label: "Blue" },
  { value: "red", label: "Red" },
  { value: "navy", label: "Navy" },
  { value: "orange", label: "Orange" },
  { value: "darkgreen", label: "Dark Green" },
  { value: "magenta", label: "Magenta" },
  { value: "black", label: "Black" },
  { value: "gray", label: "Gray" },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 whitespace-nowrap">
        {children}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium leading-none">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && (
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export function PlotGeneTab() {
  // Files
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [gtfUploadId, setGtfUploadId] = useState<string | null>(null)
  const [species, setSpecies] = useState("Human")

  // Target
  const [geneID, setGeneID] = useState("")
  const [txID, setTxID] = useState("")

  // Peak Options
  const [orderBy, setOrderBy] = useState("Target")
  const [peakCol, setPeakCol] = useState("purple")
  const [merge, setMerge] = useState("0")
  const [maxTargets, setMaxTargets] = useState("")

  // Appearance
  const [titleSize, setTitleSize] = useState("14")
  const [labelSize, setLabelSize] = useState("10")
  const [nPositionMarkers, setNPositionMarkers] = useState("5")
  const [totalArrows, setTotalArrows] = useState("6")
  const [maxPerIntron, setMaxPerIntron] = useState("2")

  // Options
  const [fiveToThree, setFiveToThree] = useState(false)
  const [showJunctions, setShowJunctions] = useState(false)

  // Highlight region
  const [highlightEnabled, setHighlightEnabled] = useState(false)
  const [highlightStart, setHighlightStart] = useState("")
  const [highlightEnd, setHighlightEnd] = useState("")
  const [highlightCol, setHighlightCol] = useState("red")

  // Result
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    if (!uploadId || !geneID.trim()) return
    setLoading(true)
    setError(null)
    setImageUrl(null)
    try {
      const url = await runPlotGene({
        uploadId,
        gtfUploadId: gtfUploadId ?? undefined,
        geneID: geneID.trim(),
        species,
        peakCol,
        orderBy,
        fiveToThree: fiveToThree ? "TRUE" : "FALSE",
        txID,
        merge,
        totalArrows,
        maxPerIntron,
        maxTargets,
        titleSize,
        labelSize,
        nPositionMarkers,
        showJunctions: showJunctions ? "TRUE" : "FALSE",
        highlightStart: highlightEnabled ? highlightStart : "",
        highlightEnd: highlightEnabled ? highlightEnd : "",
        highlightCol: highlightEnabled ? highlightCol : "",
      })
      setImageUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const canRun = !!uploadId && !!geneID.trim() && !loading

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <form
        className="flex h-full w-[320px] shrink-0 flex-col overflow-hidden border-r bg-muted/20"
        onSubmit={(e) => {
          e.preventDefault()
          if (canRun) handleRun()
        }}
      >
        {/* Header */}
        <div className="border-b px-5 py-3.5">
          <p className="text-sm font-semibold tracking-tight">Plot Gene</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Visualize RNA-binding peaks across a gene model
          </p>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">

          {/* DATA FILES */}
          <SectionLabel>Data Files</SectionLabel>

          <FileUpload
            label="BED File"
            accept=".bed"
            onUploadComplete={(id) => setUploadId(id)}
            onClear={() => setUploadId(null)}
          />

          <FileUpload
            label="Custom GTF (optional)"
            accept=".gtf,.gz"
            onUploadComplete={(id) => setGtfUploadId(id)}
            onClear={() => setGtfUploadId(null)}
          />

          {!gtfUploadId && (
            <Field label="Species">
              <Select value={species} onValueChange={setSpecies}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Human">Human (hg38)</SelectItem>
                  <SelectItem value="Mouse">Mouse (mm10)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* TARGET */}
          <SectionLabel>Target</SectionLabel>

          <Field label="Gene ID" required>
            <Input
              placeholder="e.g. GAPDH or ENSG00000111640"
              value={geneID}
              onChange={(e) => setGeneID(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          <Field label="Transcript ID" hint="Leave blank to show all transcripts">
            <Input
              placeholder="e.g. ENST00000123456"
              value={txID}
              onChange={(e) => setTxID(e.target.value)}
              className="h-8 font-mono text-sm"
            />
          </Field>

          {/* PEAK OPTIONS */}
          <SectionLabel>Peak Options</SectionLabel>

          <Field label="Order By">
            <Select value={orderBy} onValueChange={setOrderBy}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Target">Alphabetically</SelectItem>
                <SelectItem value="Count">Peak Count</SelectItem>
                <SelectItem value="Region">Genomic Region</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Peak Color">
            <Select value={peakCol} onValueChange={setPeakCol}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Merge Peaks (bp)" hint="0 = off">
              <Input
                type="number"
                min="0"
                value={merge}
                onChange={(e) => setMerge(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Max Proteins" hint="Blank = all">
              <Input
                type="number"
                min="1"
                placeholder="All"
                value={maxTargets}
                onChange={(e) => setMaxTargets(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
          </div>

          {/* APPEARANCE */}
          <SectionLabel>Appearance</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Title Size (pt)">
              <Input
                type="number"
                min="6"
                max="32"
                value={titleSize}
                onChange={(e) => setTitleSize(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Label Size (pt)">
              <Input
                type="number"
                min="6"
                max="24"
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Position Markers">
              <Input
                type="number"
                min="0"
                value={nPositionMarkers}
                onChange={(e) => setNPositionMarkers(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Total Arrows">
              <Input
                type="number"
                min="0"
                value={totalArrows}
                onChange={(e) => setTotalArrows(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
          </div>

          <Field label="Max Arrows Per Intron">
            <Input
              type="number"
              min="1"
              value={maxPerIntron}
              onChange={(e) => setMaxPerIntron(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          {/* OPTIONS */}
          <SectionLabel>Options</SectionLabel>

          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={fiveToThree}
                onCheckedChange={(v) => setFiveToThree(v === true)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium leading-none">Orient 5′ → 3′</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Display in transcription direction
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={showJunctions}
                onCheckedChange={(v) => setShowJunctions(v === true)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium leading-none">Show Junction Lines</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Draw exon/intron boundary markers
                </p>
              </div>
            </label>
          </div>

          {/* HIGHLIGHT REGION */}
          <SectionLabel>Highlight Region</SectionLabel>

          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <Checkbox
                checked={highlightEnabled}
                onCheckedChange={(v) => setHighlightEnabled(v === true)}
              />
              <p className="text-sm font-medium leading-none">Enable Region Highlight</p>
            </label>

            {highlightEnabled && (
              <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start (bp)">
                    <Input
                      type="number"
                      placeholder="e.g. 100"
                      value={highlightStart}
                      onChange={(e) => setHighlightStart(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </Field>
                  <Field label="End (bp)">
                    <Input
                      type="number"
                      placeholder="e.g. 500"
                      value={highlightEnd}
                      onChange={(e) => setHighlightEnd(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </Field>
                </div>
                <Field label="Highlight Color">
                  <Select value={highlightCol} onValueChange={setHighlightCol}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
          </div>

        </div>

        {/* Run button */}
        <div className="border-t px-5 py-4">
          <Button type="submit" disabled={!canRun} className="w-full gap-1.5" size="sm">
            <Play className="h-3 w-3" />
            {loading ? "Running…" : "Run PlotGene"}
          </Button>
        </div>
      </form>

      {/* ── Plot area ── */}
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <PlotResult imageUrl={imageUrl} loading={loading} error={error} jobKind="gene" />
      </div>
    </div>
  )
}
