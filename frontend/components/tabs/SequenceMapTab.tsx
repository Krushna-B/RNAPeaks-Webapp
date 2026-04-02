"use client"

import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetBody, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { FileUpload } from "@/components/FileUpload"
import { PlotResult } from "@/components/PlotResult"
import { runSequenceMap } from "@/lib/api"

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const ALL_GROUPS = ["Retained", "Excluded", "Control"] as const

export function SequenceMapTab() {
  const [matsUploadId, setMatsUploadId] = useState<string | null>(null)
  const [sequence, setSequence] = useState("")
  const [widthIntoExon, setWidthIntoExon] = useState("50")
  const [widthIntoIntron, setWidthIntoIntron] = useState("250")
  const [movingAverage, setMovingAverage] = useState("40")

  // Advanced
  const [pValueRetainedExclusion, setPValueRetainedExclusion] = useState("0.05")
  const [pValueControls, setPValueControls] = useState("0.95")
  const [retainedIncLevelDiff, setRetainedIncLevelDiff] = useState("0.1")
  const [exclusionIncLevelDiff, setExclusionIncLevelDiff] = useState("-0.1")
  const [minCount, setMinCount] = useState("50")
  const [groups, setGroups] = useState<string[]>(["Retained", "Excluded", "Control"])
  const [controlMultiplier, setControlMultiplier] = useState("2")
  const [zThreshold, setZThreshold] = useState("1.96")
  const [minConsecutive, setMinConsecutive] = useState("10")
  const [title, setTitle] = useState("")
  const [retainedCol, setRetainedCol] = useState("blue")
  const [excludedCol, setExcludedCol] = useState("red")
  const [controlCol, setControlCol] = useState("black")
  const [exonCol, setExonCol] = useState("navy")
  const [lineWidth, setLineWidth] = useState("0.8")
  const [axisTextSize, setAxisTextSize] = useState("11")
  const [titleSize, setTitleSize] = useState("20")

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleGroup(g: string) {
    setGroups((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    )
  }

  async function handleRun() {
    if (!matsUploadId || !sequence.trim()) return
    setLoading(true)
    setError(null)
    setImageUrl(null)
    try {
      const url = await runSequenceMap({
        matsUploadId, sequence: sequence.trim(),
        widthIntoExon, widthIntoIntron, movingAverage,
        pValueRetainedExclusion, pValueControls,
        retainedIncLevelDiff, exclusionIncLevelDiff,
        minCount, groups: groups.join(","),
        controlMultiplier, zThreshold, minConsecutive,
        title, retainedCol, excludedCol, controlCol, exonCol,
        lineWidth, axisTextSize, titleSize,
      })
      setImageUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const canRun = !!matsUploadId && !!sequence.trim() && groups.length > 0 && !loading

  return (
    <div className="flex h-full">
      <form
        className="w-[300px] shrink-0 border-r bg-muted/20 flex flex-col overflow-hidden"
        onSubmit={(e) => { e.preventDefault(); if (canRun) handleRun() }}
      >
        <div className="px-5 py-4 border-b">
          <p className="text-sm font-medium">Sequence Map</p>
          <p className="text-xs text-muted-foreground mt-0.5">Motif density around splicing events</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <FileUpload
            label="SE.MATS File"
            accept=".txt,.tsv"
            onUploadComplete={(id) => setMatsUploadId(id)}
            onClear={() => setMatsUploadId(null)}
          />

          <FieldRow label="Sequence Motif" hint="Supports IUPAC ambiguity codes (Y, R, N, etc.)">
            <Input
              placeholder="e.g. CCCC or YCAY"
              value={sequence}
              onChange={(e) => setSequence(e.target.value.toUpperCase())}
              className="font-mono"
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Width Into Exon (bp)">
              <Input type="number" value={widthIntoExon} onChange={(e) => setWidthIntoExon(e.target.value)} />
            </FieldRow>
            <FieldRow label="Width Into Intron (bp)">
              <Input type="number" value={widthIntoIntron} onChange={(e) => setWidthIntoIntron(e.target.value)} />
            </FieldRow>
          </div>

          <FieldRow label="Moving Average Window">
            <Input type="number" value={movingAverage} onChange={(e) => setMovingAverage(e.target.value)} />
          </FieldRow>
        </div>

        <div className="px-5 py-4 border-t flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Advanced
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Advanced Settings</SheetTitle>
                <SheetDescription>Statistical thresholds and visual styling</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm">Event Groups</Label>
                  <div className="flex gap-4">
                    {ALL_GROUPS.map((g) => (
                      <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={groups.includes(g)}
                          onCheckedChange={() => toggleGroup(g)}
                        />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Statistical Filters</p>

                  <FieldRow label="p-value (Retained / Excluded)" hint="Max p-value for retained/excluded events">
                    <Input type="number" min="0" max="1" step="0.01" value={pValueRetainedExclusion} onChange={(e) => setPValueRetainedExclusion(e.target.value)} />
                  </FieldRow>

                  <FieldRow label="p-value (Controls)" hint="Min p-value for control events">
                    <Input type="number" min="0" max="1" step="0.01" value={pValueControls} onChange={(e) => setPValueControls(e.target.value)} />
                  </FieldRow>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Retained ΔInc" hint="Min inclusion level difference">
                      <Input type="number" step="0.05" value={retainedIncLevelDiff} onChange={(e) => setRetainedIncLevelDiff(e.target.value)} />
                    </FieldRow>
                    <FieldRow label="Excluded ΔInc" hint="Max (negative) inclusion difference">
                      <Input type="number" step="0.05" value={exclusionIncLevelDiff} onChange={(e) => setExclusionIncLevelDiff(e.target.value)} />
                    </FieldRow>
                  </div>

                  <FieldRow label="Min Read Count">
                    <Input type="number" min="1" value={minCount} onChange={(e) => setMinCount(e.target.value)} />
                  </FieldRow>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Control Multiplier">
                      <Input type="number" min="0.1" step="0.5" value={controlMultiplier} onChange={(e) => setControlMultiplier(e.target.value)} />
                    </FieldRow>
                    <FieldRow label="Z Threshold">
                      <Input type="number" step="0.1" value={zThreshold} onChange={(e) => setZThreshold(e.target.value)} />
                    </FieldRow>
                  </div>

                  <FieldRow label="Min Consecutive Positions">
                    <Input type="number" min="1" value={minConsecutive} onChange={(e) => setMinConsecutive(e.target.value)} />
                  </FieldRow>
                </div>

                <div className="border-t pt-4 space-y-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Appearance</p>

                  <FieldRow label="Plot Title">
                    <Input placeholder="Optional title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </FieldRow>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Title Size (pt)">
                      <Input type="number" min="8" value={titleSize} onChange={(e) => setTitleSize(e.target.value)} />
                    </FieldRow>
                    <FieldRow label="Axis Text Size (pt)">
                      <Input type="number" min="6" value={axisTextSize} onChange={(e) => setAxisTextSize(e.target.value)} />
                    </FieldRow>
                  </div>

                  <FieldRow label="Line Width">
                    <Input type="number" min="0.1" step="0.1" value={lineWidth} onChange={(e) => setLineWidth(e.target.value)} />
                  </FieldRow>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Retained Color">
                      <Input value={retainedCol} onChange={(e) => setRetainedCol(e.target.value)} />
                    </FieldRow>
                    <FieldRow label="Excluded Color">
                      <Input value={excludedCol} onChange={(e) => setExcludedCol(e.target.value)} />
                    </FieldRow>
                    <FieldRow label="Control Color">
                      <Input value={controlCol} onChange={(e) => setControlCol(e.target.value)} />
                    </FieldRow>
                    <FieldRow label="Exon Color">
                      <Input value={exonCol} onChange={(e) => setExonCol(e.target.value)} />
                    </FieldRow>
                  </div>
                </div>
              </SheetBody>
            </SheetContent>
          </Sheet>

          <Button type="submit" disabled={!canRun} className="flex-1">
            {loading ? "Running…" : "Run Sequence Map"}
          </Button>
        </div>
      </form>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-6">
        <PlotResult imageUrl={imageUrl} loading={loading} error={error} jobKind="sequence" />
      </div>
    </div>
  )
}
