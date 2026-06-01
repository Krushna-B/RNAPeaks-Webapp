"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileUpload } from "@/components/FileUpload"
import { TableResult } from "@/components/TableResult"
import { runControlPeaks, type ControlPeaksResult } from "@/lib/api"

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

export function ControlPeaksTab() {
  const [bedSource, setBedSource] = useState<"K562" | "HepG2" | "upload">("K562")
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [seed, setSeed] = useState("1234")

  const [result, setResult] = useState<ControlPeaksResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await runControlPeaks({
        uploadId: bedSource === "upload" ? (uploadId ?? "") : "",
        bedSource: bedSource !== "upload" ? bedSource : undefined,
        seed,
      })
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const canRun = !loading && (bedSource !== "upload" || !!uploadId)

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
          <p className="text-sm font-semibold tracking-tight">Control Peaks</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Strand- and region-matched control peaks
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <SectionLabel>Data Files</SectionLabel>

          <div className="space-y-2">
            <p className="text-xs font-medium">Peak BED File</p>
            <div className="flex gap-4">
              {(["K562", "HepG2"] as const).map((src) => (
                <label
                  key={src}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <Checkbox
                    checked={bedSource === src}
                    onCheckedChange={() => {
                      setBedSource(src)
                      setUploadId(null)
                    }}
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
                onUploadComplete={(id) => setUploadId(id)}
                onClear={() => setUploadId(null)}
              />
            )}
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            For each peak, a length-, strand- and region-matched control region
            is sampled using the bundled GENCODE v46 annotation.
          </p>

          <SectionLabel>Options</SectionLabel>

          <Field label="Random Seed" hint="Controls reproducible sampling">
            <Input
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
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
            {loading ? "Running…" : "Generate Control Peaks"}
          </Button>
        </div>
      </form>

      {/* ── Result ── */}
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <TableResult result={result} loading={loading} error={error} />
      </div>
    </div>
  )
}
