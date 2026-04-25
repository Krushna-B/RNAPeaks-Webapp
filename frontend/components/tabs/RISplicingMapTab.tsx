"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileUpload } from "@/components/FileUpload"
import { PlotResult } from "@/components/PlotResult"
import { runRISplicingMap } from "@/lib/api"

const LINE_COLOR_OPTIONS = [
  { value: "blue", label: "Blue" },
  { value: "red", label: "Red" },
  { value: "black", label: "Black" },
  { value: "navy", label: "Navy" },
  { value: "darkgreen", label: "Dark Green" },
  { value: "orange", label: "Orange" },
  { value: "purple", label: "Purple" },
  { value: "magenta", label: "Magenta" },
  { value: "gray40", label: "Gray" },
]


function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="text-[10px] font-bold tracking-[0.1em] whitespace-nowrap text-muted-foreground/60 uppercase">
        {children}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs leading-none font-medium">{label}</Label>
      {children}
      {hint && (
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

const ALL_GROUPS = ["Retained", "Excluded", "Control"] as const

export function RISplicingMapTab() {
  const [bedSource, setBedSource] = useState<"K562" | "HepG2" | "upload">("K562")
  const [bedUploadId, setBedUploadId] = useState<string | null>(null)
  const [matsUploadId, setMatsUploadId] = useState<string | null>(null)

  // Main params
  const [widthIntoExon, setWidthIntoExon] = useState("50")
  const [widthIntoIntron, setWidthIntoIntron] = useState("300")
  const [movingAverage, setMovingAverage] = useState("50")

  // Statistical filters
  const [pValueRetainedExclusion, setPValueRetainedExclusion] = useState("0.05")
  const [pValueControls, setPValueControls] = useState("0.95")
  const [retainedIncLevelDiff, setRetainedIncLevelDiff] = useState("0.1")
  const [exclusionIncLevelDiff, setExclusionIncLevelDiff] = useState("-0.1")
  const [minCount, setMinCount] = useState("50")
  const [groups, setGroups] = useState<string[]>([
    "Retained",
    "Excluded",
    "Control",
  ])

  // Control sampling
  const [controlMultiplier, setControlMultiplier] = useState("2")
  const [controlIterations, setControlIterations] = useState("20")

  // Significance
  const [fdrThreshold, setFdrThreshold] = useState("0.05")

  // Appearance
  const [title, setTitle] = useState("")
  const [titleSize, setTitleSize] = useState("20")
  const [axisTextSize, setAxisTextSize] = useState("11")
  const [lineWidth, setLineWidth] = useState("0.8")
  const [retainedCol, setRetainedCol] = useState("blue")
  const [excludedCol, setExcludedCol] = useState("red")
  const [controlCol, setControlCol] = useState("black")

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleGroup(g: string) {
    setGroups((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    )
  }

  async function handleRun() {
    if (groups.length === 0) return
    setLoading(true)
    setError(null)
    setImageUrl(null)
    try {
      const url = await runRISplicingMap({
        bedUploadId: bedSource === "upload" ? (bedUploadId ?? "") : "",
        bedSource: bedSource !== "upload" ? bedSource : undefined,
        matsUploadId: matsUploadId ?? "",
        widthIntoExon,
        widthIntoIntron,
        movingAverage,
        pValueRetainedExclusion,
        pValueControls,
        retainedIncLevelDiff,
        exclusionIncLevelDiff,
        minCount,
        groups: groups.join(","),
        controlMultiplier,
        controlIterations,
        fdrThreshold,
        title,
        retainedCol,
        excludedCol,
        controlCol,
        lineWidth,
        axisTextSize,
        titleSize,
      })
      setImageUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const canRun = groups.length > 0 && !loading

  const retainedLabel = `ΔΨ > ${retainedIncLevelDiff}`
  const excludedLabel = `ΔΨ < ${exclusionIncLevelDiff}`

  const groupLabel: Record<string, string> = {
    Retained: retainedLabel,
    Excluded: excludedLabel,
    Control: "Control",
  }

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
          <p className="text-sm font-semibold tracking-tight">RI Splicing Map</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Peak density around retained intron events
          </p>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* DATA FILES */}
          <SectionLabel>Data Files</SectionLabel>

          <div className="space-y-2">
            <p className="text-xs font-medium">BED File</p>
            <div className="flex gap-4">
              {(["K562", "HepG2"] as const).map((src) => (
                <label key={src} className="flex cursor-pointer items-center gap-1.5">
                  <Checkbox
                    checked={bedSource === src}
                    onCheckedChange={() => { setBedSource(src); setBedUploadId(null) }}
                  />
                  <span className="text-sm">{src} (default)</span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-1.5">
                <Checkbox
                  checked={bedSource === "upload"}
                  onCheckedChange={() => setBedSource("upload")}
                />
                <span className="text-sm">Upload own</span>
              </label>
            </div>
            {bedSource === "upload" && (
              <FileUpload
                label=""
                accept=".bed"
                onUploadComplete={(id) => setBedUploadId(id)}
                onClear={() => setBedUploadId(null)}
              />
            )}
          </div>

          <FileUpload
            label="RI.MATS File"
            accept=".txt,.tsv"
            onUploadComplete={(id) => setMatsUploadId(id)}
            onClear={() => setMatsUploadId(null)}
          />
          {!matsUploadId && (
            <p className="-mt-2 text-[11px] text-muted-foreground">
              No file selected - sample SE.MATS data will be used
            </p>
          )}

          {/* PARAMETERS */}
          <SectionLabel>Parameters</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Width Into Exon (bp)">
              <Input
                type="number"
                value={widthIntoExon}
                onChange={(e) => setWidthIntoExon(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Width Into Intron (bp)">
              <Input
                type="number"
                value={widthIntoIntron}
                onChange={(e) => setWidthIntoIntron(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
          </div>

          <Field label="Moving Average Window">
            <Input
              type="number"
              value={movingAverage}
              onChange={(e) => setMovingAverage(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          {/* EVENT GROUPS */}
          <SectionLabel>Event Groups</SectionLabel>

          <div className="flex gap-4">
            {ALL_GROUPS.map((g) => (
              <label
                key={g}
                className="flex cursor-pointer items-center gap-1.5"
              >
                <Checkbox
                  checked={groups.includes(g)}
                  onCheckedChange={() => toggleGroup(g)}
                />
                <span className="text-sm">{groupLabel[g]}</span>
              </label>
            ))}
          </div>

          {/* SIGNIFICANCE */}
          <SectionLabel>Significance</SectionLabel>

          <Field label="FDR Threshold">
            <Input
              type="number"
              min="0"
              max="1"
              step="any"
              value={fdrThreshold}
              onChange={(e) => setFdrThreshold(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          {/* CONTROL SAMPLING */}
          <SectionLabel>Control Sampling</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Multiplier">
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={controlMultiplier}
                onChange={(e) => setControlMultiplier(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Iterations">
              <Input
                type="number"
                min="1"
                step="1"
                value={controlIterations}
                onChange={(e) => setControlIterations(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
          </div>

          {/* STATISTICAL FILTERS */}
          <SectionLabel>Statistical Filters</SectionLabel>

          <Field label="p-value (Retained / Excluded)">
            <Input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={pValueRetainedExclusion}
              onChange={(e) => setPValueRetainedExclusion(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          <Field label="p-value (Controls)">
            <Input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={pValueControls}
              onChange={(e) => setPValueControls(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Retained ΔΨ">
              <Input
                type="number"
                step="0.01"
                value={retainedIncLevelDiff}
                onChange={(e) => setRetainedIncLevelDiff(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Excluded ΔΨ">
              <Input
                type="number"
                step="0.01"
                value={exclusionIncLevelDiff}
                onChange={(e) => setExclusionIncLevelDiff(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
          </div>

          <Field label="Min Read Count">
            <Input
              type="number"
              min="1"
              value={minCount}
              onChange={(e) => setMinCount(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          {/* APPEARANCE */}
          <SectionLabel>Appearance</SectionLabel>

          <Field label="Plot Title">
            <Input
              placeholder="Optional title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Title Size (pt)">
              <Input
                type="number"
                min="1"
                value={titleSize}
                onChange={(e) => setTitleSize(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Axis Text Size (pt)">
              <Input
                type="number"
                min="1"
                value={axisTextSize}
                onChange={(e) => setAxisTextSize(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
          </div>

          <Field label="Line Width">
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={lineWidth}
              onChange={(e) => setLineWidth(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`${retainedLabel} Color`}>
              <Select value={retainedCol} onValueChange={setRetainedCol}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`${excludedLabel} Color`}>
              <Select value={excludedCol} onValueChange={setExcludedCol}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Control Color">
              <Select value={controlCol} onValueChange={setControlCol}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {/* Run button */}
        <div className="border-t px-5 py-4">
          <Button
            type="submit"
            disabled={!canRun}
            className="w-full gap-1.5"
            size="sm"
          >
            <Play className="h-3 w-3" />
            {loading ? "Running…" : "Run RI Splicing Map"}
          </Button>
        </div>
      </form>

      {/* ── Plot area ── */}
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <PlotResult
          imageUrl={imageUrl}
          loading={loading}
          error={error}
          jobKind="splicing"
        />
      </div>
    </div>
  )
}
