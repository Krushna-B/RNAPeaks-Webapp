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
import { KmerResult } from "@/components/KmerResult"
import { runKmerEnrichment, type KmerEnrichmentResult } from "@/lib/api"

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

type SetMode = "bed" | "ids"
type BedChoice = "K562" | "HepG2" | "upload"

interface SetState {
  mode: SetMode
  bedChoice: BedChoice
  uploadId: string | null
  ids: string
}

const emptySet = (bedChoice: BedChoice): SetState => ({
  mode: "bed",
  bedChoice,
  uploadId: null,
  ids: "",
})

function SetInput({
  title,
  state,
  onChange,
}: {
  title: string
  state: SetState
  onChange: (next: SetState) => void
}) {
  return (
    <div className="space-y-2.5 rounded-md border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">{title}</p>
        <div className="flex gap-3">
          {(["bed", "ids"] as const).map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-center gap-1.5"
            >
              <Checkbox
                checked={state.mode === m}
                onCheckedChange={() => onChange({ ...state, mode: m })}
              />
              <span className="text-xs">
                {m === "bed" ? "BED peaks" : "ID list"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {state.mode === "bed" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3">
            {(["K562", "HepG2", "upload"] as const).map((c) => (
              <label
                key={c}
                className="flex cursor-pointer items-center gap-1.5"
              >
                <Checkbox
                  checked={state.bedChoice === c}
                  onCheckedChange={() =>
                    onChange({
                      ...state,
                      bedChoice: c,
                      uploadId: c === "upload" ? state.uploadId : null,
                    })
                  }
                />
                <span className="text-sm">
                  {c === "upload" ? "Upload own" : `${c} (default)`}
                </span>
              </label>
            ))}
          </div>
          {state.bedChoice === "upload" && (
            <FileUpload
              label=""
              accept=".bed"
              onUploadComplete={(id) => onChange({ ...state, uploadId: id })}
              onClear={() => onChange({ ...state, uploadId: null })}
            />
          )}
        </div>
      ) : (
        <textarea
          value={state.ids}
          onChange={(e) => onChange({ ...state, ids: e.target.value })}
          placeholder="Gene or transcript ids, separated by spaces, commas or new lines (e.g. GAPDH, ACTB, ENST00000373020)"
          className="min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      )}
    </div>
  )
}

function setToParams(s: SetState) {
  if (s.mode === "ids") {
    return { mode: "ids" as const, ids: s.ids }
  }
  return s.bedChoice === "upload"
    ? { mode: "bed" as const, uploadId: s.uploadId ?? "" }
    : { mode: "bed" as const, bedSource: s.bedChoice }
}

function setReady(s: SetState): boolean {
  if (s.mode === "ids") return s.ids.trim().length > 0
  if (s.bedChoice === "upload") return !!s.uploadId
  return true
}

export function KmerEnrichmentTab() {
  const [setA, setSetA] = useState<SetState>(emptySet("K562"))
  const [setB, setSetB] = useState<SetState>(emptySet("HepG2"))

  const [k, setK] = useState("4")
  const [species, setSpecies] = useState("hg38")
  const [labelA, setLabelA] = useState("Set A")
  const [labelB, setLabelB] = useState("Set B")
  const [topN, setTopN] = useState("20")
  const [title, setTitle] = useState("")

  const [result, setResult] = useState<KmerEnrichmentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await runKmerEnrichment({
        setA: setToParams(setA),
        setB: setToParams(setB),
        k,
        species,
        labelA,
        labelB,
        topN,
        title,
      })
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const canRun = !loading && setReady(setA) && setReady(setB)

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
        <div className="border-b px-5 py-3.5">
          <p className="text-sm font-semibold tracking-tight">
            K-mer Enrichment
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compare k-mer frequencies between two sets
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <SectionLabel>Sets to Compare</SectionLabel>

          <SetInput title="Set A" state={setA} onChange={setSetA} />
          <SetInput title="Set B" state={setB} onChange={setSetB} />

          <p className="text-[11px] leading-snug text-muted-foreground">
            Each set is a BED peak file (built-in or uploaded) or a list of
            gene / transcript ids. The report shows the per-k-mer frequency
            difference (Set A − Set B).
          </p>

          <SectionLabel>Options</SectionLabel>

          <Field label="K-mer Length (k)" hint="1–12">
            <Input
              type="number"
              min={1}
              max={12}
              value={k}
              onChange={(e) => setK(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          <Field label="Species">
            <Select value={species} onValueChange={setSpecies}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hg38">Human (hg38)</SelectItem>
                <SelectItem value="mm10">Mouse (mm10)</SelectItem>
                <SelectItem value="mm39">Mouse (mm39)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Labels"
            hint="Names used on plot axes and the legend"
          >
            <div className="flex gap-2">
              <Input
                value={labelA}
                onChange={(e) => setLabelA(e.target.value)}
                placeholder="Set A"
                className="h-8 text-sm"
              />
              <Input
                value={labelB}
                onChange={(e) => setLabelB(e.target.value)}
                placeholder="Set B"
                className="h-8 text-sm"
              />
            </div>
          </Field>

          <Field
            label="Top N Labeled"
            hint="K-mers labeled in the scatter plot (by |difference|)"
          >
            <Input
              type="number"
              min={0}
              value={topN}
              onChange={(e) => setTopN(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

          <Field label="Plot Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="(optional)"
              className="h-8 text-sm"
            />
          </Field>
        </div>

        <div className="border-t px-5 py-4">
          <Button
            type="submit"
            disabled={!canRun}
            className="w-full gap-1.5"
            size="sm"
          >
            <Play className="h-3 w-3" />
            {loading ? "Running…" : "Run K-mer Enrichment"}
          </Button>
        </div>
      </form>

      {/* ── Result ── */}
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <KmerResult result={result} loading={loading} error={error} />
      </div>
    </div>
  )
}
