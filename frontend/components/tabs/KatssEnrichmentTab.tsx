"use client"

import { useEffect, useRef, useState } from "react"
import { Play, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KatssResult } from "@/components/KatssResult"
import {
  submitKatssJob,
  getKatssJobStatus,
  getKatssResults,
  type KatssResults,
  type KatssStatus,
} from "@/lib/katss"

const POLL_INTERVAL_MS = 2500
// Tolerate transient network blips (Render cold starts) before giving up —
// ~8 consecutive misses at 2.5s ≈ 20s of unreachability.
const MAX_POLL_FAILURES = 8

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

// A bordered, selectable row with a radio dot — mirrors KATSS's own
// "Algorithm Selection" cards.
function RadioCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-input hover:bg-accent"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-primary" : "border-muted-foreground/50"
        }`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      {children}
    </button>
  )
}

// A bordered checkbox card with a bold label and description — the KATSS
// "Algorithm Parameters" style. Renders optional revealed fields when checked.
function CheckCard({
  checked,
  onCheckedChange,
  label,
  description,
  children,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-2.5 rounded-md border px-3 py-2.5">
      <label className="flex cursor-pointer items-start gap-2.5">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-[11px] leading-snug text-muted-foreground">
            {description}
          </span>
        </span>
      </label>
      {checked && children}
    </div>
  )
}

function FilePicker({
  file,
  onChange,
  accept,
}: {
  file: File | null
  onChange: (f: File | null) => void
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-background/60 px-2.5 py-1.5">
          <span className="truncate text-xs" title={file.name}>
            {file.name}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              if (inputRef.current) inputRef.current.value = ""
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          Choose file
        </button>
      )}
    </div>
  )
}

const FILE_ACCEPT = ".fastq.gz,.fastq,.fq.gz,.fq,.fasta,.fa,.csv,.txt,.gz"

type Algorithm = "regular" | "ikke"

export function KatssEnrichmentTab() {
  const [testFile, setTestFile] = useState<File | null>(null)
  const [controlFile, setControlFile] = useState<File | null>(null)

  // Algorithm: Regular Enrichments (all k-mers) or IKKE (iterative knockout).
  const [algorithm, setAlgorithm] = useState<Algorithm>("regular")
  const [kmer, setKmer] = useState("5")
  const [iterations, setIterations] = useState("1")

  // Algorithm parameters.
  const [probabilistic, setProbabilistic] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [klet, setKlet] = useState("2")
  const [bootstrapOn, setBootstrapOn] = useState(false)
  const [bootstrap, setBootstrap] = useState("100")
  const [sample, setSample] = useState("10")

  const [delimiter, setDelimiter] = useState(",")
  const [seed, setSeed] = useState("-1")

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<KatssStatus | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [results, setResults] = useState<KatssResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => stopPolling, [])

  async function handleRun() {
    if (!testFile) return
    stopPolling()
    setLoading(true)
    setError(null)
    setResults(null)
    setProgress(null)
    setStatus(null)

    try {
      const submit = await submitKatssJob({
        testFile,
        controlFile,
        enrichments: algorithm === "regular",
        kmer,
        iterations,
        independentProbs: probabilistic,
        shuffle,
        klet: shuffle ? klet : undefined,
        bootstrap: bootstrapOn ? bootstrap : undefined,
        sample: bootstrapOn ? sample : undefined,
        delimiter,
        seed,
      })
      const jobId = submit.job_id
      setStatus(submit.status)

      // The KATSS server is flaky to reach (free tier + cold starts), so a
      // single failed status poll must NOT abort the job — the work is still
      // running server-side. Only give up after several consecutive failures.
      let consecutiveFailures = 0
      pollRef.current = setInterval(async () => {
        try {
          const s = await getKatssJobStatus(jobId)
          consecutiveFailures = 0
          setStatus(s.status)
          setProgress(s.progress ?? null)

          if (s.status === "completed") {
            stopPolling()
            const res = await getKatssResults(jobId)
            setResults(res)
            setLoading(false)
          } else if (s.status === "failed") {
            stopPolling()
            setError(s.error_message ?? "The KATSS job failed.")
            setLoading(false)
          }
        } catch (e) {
          consecutiveFailures += 1
          if (consecutiveFailures >= MAX_POLL_FAILURES) {
            stopPolling()
            setError(
              e instanceof Error ? e.message : "Lost contact with the job."
            )
            setLoading(false)
          }
        }
      }, POLL_INTERVAL_MS)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed")
      setLoading(false)
    }
  }

  const canRun = !loading && !!testFile

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
            KATSS Enrichment
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            k-mer motif enrichment (external server)
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <SectionLabel>Sequence Files</SectionLabel>

          <Field
            label="Test File (required)"
            hint="Bound / selected sequences — FASTQ(.gz), FASTA, or CSV"
          >
            <FilePicker
              file={testFile}
              onChange={setTestFile}
              accept={FILE_ACCEPT}
            />
          </Field>

          <Field
            label="Control File"
            hint="Background sequences (optional if Probabilistic is on)"
          >
            <FilePicker
              file={controlFile}
              onChange={setControlFile}
              accept={FILE_ACCEPT}
            />
          </Field>

          <SectionLabel>Algorithm Selection</SectionLabel>

          <div className="space-y-2">
            <RadioCard
              selected={algorithm === "regular"}
              onSelect={() => setAlgorithm("regular")}
            >
              Regular Enrichments
            </RadioCard>
            <RadioCard
              selected={algorithm === "ikke"}
              onSelect={() => setAlgorithm("ikke")}
            >
              Iterative k-mer Knockout Enrichments (IKKE)
            </RadioCard>
          </div>

          <Field label="k-mer length" hint="Range: 1–12">
            <Input
              type="number"
              min={1}
              max={12}
              value={kmer}
              onChange={(e) => setKmer(e.target.value)}
              className="h-9 text-sm"
            />
          </Field>

          {algorithm === "ikke" && (
            <Field label="Iterations" hint="k-mers to iteratively knock out">
              <Input
                type="number"
                min={1}
                value={iterations}
                onChange={(e) => setIterations(e.target.value)}
                className="h-9 text-sm"
              />
            </Field>
          )}

          <SectionLabel>Algorithm Parameters</SectionLabel>

          <div className="space-y-2.5">
            <CheckCard
              checked={probabilistic}
              onCheckedChange={setProbabilistic}
              label="Probabilistic"
              description="Calculate enrichments without control file"
            />

            <CheckCard
              checked={shuffle}
              onCheckedChange={setShuffle}
              label="Shuffled Sequences"
              description="Shuffle sequences preserving k-let count"
            >
              <Field label="k-let count">
                <Input
                  type="number"
                  min={1}
                  value={klet}
                  onChange={(e) => setKlet(e.target.value)}
                  className="h-8 text-sm"
                />
              </Field>
            </CheckCard>

            <CheckCard
              checked={bootstrapOn}
              onCheckedChange={setBootstrapOn}
              label="Bootstrap"
              description="Randomly subsample sequences multiple times"
            >
              <div className="grid grid-cols-2 gap-2">
                <Field label="Iterations">
                  <Input
                    type="number"
                    min={1}
                    value={bootstrap}
                    onChange={(e) => setBootstrap(e.target.value)}
                    className="h-8 text-sm"
                  />
                </Field>
                <Field label="Sample %">
                  <Input
                    type="number"
                    value={sample}
                    onChange={(e) => setSample(e.target.value)}
                    className="h-8 text-sm"
                  />
                </Field>
              </div>
            </CheckCard>
          </div>

          <SectionLabel>Other</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Delimiter" hint="CSV inputs">
              <Input
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Seed" hint="-1 = random">
              <Input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="h-8 text-sm"
              />
            </Field>
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            Jobs run on the external KATSS server and may take a few minutes;
            the server can be slow to wake on the first request.
          </p>
        </div>

        <div className="border-t px-5 py-4">
          <Button
            type="submit"
            disabled={!canRun}
            className="w-full gap-1.5"
            size="sm"
          >
            <Play className="h-3 w-3" />
            {loading ? "Running…" : "Run KATSS Enrichment"}
          </Button>
        </div>
      </form>

      {/* ── Result ── */}
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <KatssResult
          loading={loading}
          status={status}
          progress={progress}
          error={error}
          results={results}
        />
      </div>
    </div>
  )
}
