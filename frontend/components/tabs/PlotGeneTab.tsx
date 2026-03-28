"use client"

import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetBody, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
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
  { value: "black", label: "Black" },
  { value: "gray", label: "Gray" },
]

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function PlotGeneTab() {
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [geneID, setGeneID] = useState("")
  const [species, setSpecies] = useState("Human")
  const [peakCol, setPeakCol] = useState("purple")
  const [orderBy, setOrderBy] = useState("Count")
  const [fiveToThree, setFiveToThree] = useState("FALSE")

  // Advanced
  const [txID, setTxID] = useState("")
  const [merge, setMerge] = useState("0")
  const [totalArrows, setTotalArrows] = useState("6")
  const [maxPerIntron, setMaxPerIntron] = useState("2")
  const [exonCol, setExonCol] = useState("black")
  const [utrCol, setUtrCol] = useState("dark gray")
  const [peaksWidth, setPeaksWidth] = useState("0.3")

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
        uploadId, geneID: geneID.trim(), species, peakCol, orderBy, fiveToThree,
        txID, merge, totalArrows, maxPerIntron, exonCol, utrCol, peaksWidth,
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
      <aside className="w-[300px] shrink-0 border-r bg-muted/20 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b">
          <p className="text-sm font-medium">Plot Gene</p>
          <p className="text-xs text-muted-foreground mt-0.5">Visualize peaks across a gene model</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <FileUpload
            label="BED File"
            accept=".bed"
            onUploadComplete={(id) => setUploadId(id)}
            onClear={() => setUploadId(null)}
          />

          <FieldRow label="Gene ID">
            <Input
              placeholder="e.g. GAPDH or ENSG00000111640"
              value={geneID}
              onChange={(e) => setGeneID(e.target.value)}
            />
          </FieldRow>

          <FieldRow label="Species">
            <Select value={species} onValueChange={setSpecies}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Human">Human</SelectItem>
                <SelectItem value="Mouse">Mouse</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Order Tracks By">
            <Select value={orderBy} onValueChange={setOrderBy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Count">Peak Count</SelectItem>
                <SelectItem value="Target">Alphabetically</SelectItem>
                <SelectItem value="Region">Genomic Region</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Peak Color">
            <Select value={peakCol} onValueChange={setPeakCol}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Orientation">
            <Select value={fiveToThree} onValueChange={setFiveToThree}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FALSE">Genomic coordinates</SelectItem>
                <SelectItem value="TRUE">5′ → 3′</SelectItem>
              </SelectContent>
            </Select>
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
                <SheetDescription>Fine-tune plot appearance and filtering</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-5">
                <FieldRow label="Transcript ID" hint="Filter to a specific transcript (leave blank for all)">
                  <Input
                    placeholder="e.g. ENST00000123456"
                    value={txID}
                    onChange={(e) => setTxID(e.target.value)}
                    className="font-mono text-sm"
                  />
                </FieldRow>

                <FieldRow label="Merge Overlapping Peaks (bp)" hint="Merge peaks within N bp of each other. 0 = disabled">
                  <Input type="number" min="0" value={merge} onChange={(e) => setMerge(e.target.value)} />
                </FieldRow>

                <FieldRow label="Intron Arrows" hint="Number of direction arrows drawn per intron">
                  <Input type="number" min="0" value={totalArrows} onChange={(e) => setTotalArrows(e.target.value)} />
                </FieldRow>

                <FieldRow label="Max Peaks Per Intron" hint="Cap displayed peaks in each intron region">
                  <Input type="number" min="1" value={maxPerIntron} onChange={(e) => setMaxPerIntron(e.target.value)} />
                </FieldRow>

                <FieldRow label="Exon Color" hint="Any R color name or hex (e.g. #3b82f6)">
                  <Input value={exonCol} onChange={(e) => setExonCol(e.target.value)} />
                </FieldRow>

                <FieldRow label="UTR Color" hint="Any R color name or hex">
                  <Input value={utrCol} onChange={(e) => setUtrCol(e.target.value)} />
                </FieldRow>

                <FieldRow label="Peak Track Width" hint="Height of each peak track (0.1 – 1.0)">
                  <Input type="number" min="0.1" max="1" step="0.05" value={peaksWidth} onChange={(e) => setPeaksWidth(e.target.value)} />
                </FieldRow>
              </SheetBody>
            </SheetContent>
          </Sheet>

          <Button onClick={handleRun} disabled={!canRun} className="flex-1">
            {loading ? "Running…" : "Run PlotGene"}
          </Button>
        </div>
      </aside>

      <div className="flex-1 overflow-auto p-6">
        <PlotResult imageUrl={imageUrl} loading={loading} error={error} />
      </div>
    </div>
  )
}
