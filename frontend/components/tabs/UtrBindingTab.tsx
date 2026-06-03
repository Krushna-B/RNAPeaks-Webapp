"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Download, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import {
  BedSelector,
  bedParams,
  hasBed,
  EMPTY_BED_SELECTION,
  type BedSelection,
} from "@/components/BedSelector"
import { runUtrBinding } from "@/lib/api"

const STRUCTURE_COLOR_OPTIONS = [
  { value: "navy", label: "Navy" },
  { value: "black", label: "Black" },
  { value: "blue", label: "Blue" },
  { value: "darkgreen", label: "Dark Green" },
  { value: "red", label: "Red" },
  { value: "lightgray", label: "Light Gray" },
  { value: "orange", label: "Orange" },
  { value: "purple", label: "Purple" },
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

function downloadPng(url: string, filename: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
}

async function downloadPdf(url: string, label: string) {
  const img = new Image()
  img.src = url
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
  })
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0)
  const dataUrl = canvas.toDataURL("image/png")
  const { jsPDF } = await import("jspdf")
  const orientation = img.naturalWidth >= img.naturalHeight ? "l" : "p"
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [img.naturalWidth, img.naturalHeight],
    hotfixes: ["px_scaling"],
  })
  pdf.addImage(dataUrl, "PNG", 0, 0, img.naturalWidth, img.naturalHeight)
  pdf.save(`rnapeaks-${label}.pdf`)
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

export function UtrBindingTab() {
  const [bed, setBed] = useState<BedSelection>(EMPTY_BED_SELECTION)
  const [gtfUploadId, setGtfUploadId] = useState<string | null>(null)
  const [species, setSpecies] = useState("hg38")

  const [transcripts, setTranscripts] = useState("")
  const [movingAverage, setMovingAverage] = useState("5")

  const [title, setTitle] = useState("")
  const [titleSize, setTitleSize] = useState("20")
  const [axisTextSize, setAxisTextSize] = useState("11")
  const [lineWidth, setLineWidth] = useState("0.8")
  const [utrFill, setUtrFill] = useState("lightgray")
  const [cdsFill, setCdsFill] = useState("navy")
  const [singleTrackColor, setSingleTrackColor] = useState("blue")

  const [images, setImages] = useState<{ label: string; url: string }[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setLoading(true)
    setError(null)
    setImages([])
    setIndex(0)

    const commonParams = {
      ...bedParams(bed),
      gtfUploadId: gtfUploadId ?? undefined,
      species,
      transcripts,
      movingAverage,
      title,
      lineWidth,
      axisTextSize,
      titleSize,
      utrFill,
      cdsFill,
      singleTrackColor,
    }

    const sides: { side: "utr5" | "utr3"; label: string }[] = [
      { side: "utr5", label: "5′ UTR" },
      { side: "utr3", label: "3′ UTR" },
    ]

    try {
      const results = await Promise.all(
        sides.map(({ side, label }) =>
          runUtrBinding({ ...commonParams, side }).then((url) => ({
            label,
            url,
          }))
        )
      )
      setImages(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const canRun = !loading && hasBed(bed)
  const showCarousel = images.length > 0 && !loading && !error
  const curImage = showCarousel ? images[index] : null

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
          <p className="text-sm font-semibold tracking-tight">UTR Binding</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Peak density across 5′ and 3′ UTRs
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <SectionLabel>Data Files</SectionLabel>

          <BedSelector value={bed} onChange={setBed} />
          <p className="text-[11px] leading-snug text-muted-foreground">
            One density curve is drawn per BED track.
          </p>

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
                  <SelectItem value="hg38">Human (hg38)</SelectItem>
                  <SelectItem value="mm10">Mouse (mm10)</SelectItem>
                  <SelectItem value="mm39">Mouse (mm39)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          <SectionLabel>Target</SectionLabel>

          <Field
            label="Transcript IDs"
            hint="Comma-separated; blank = all protein-coding transcripts"
          >
            <Input
              placeholder="e.g. ENST00000123456, ENST00000654321"
              value={transcripts}
              onChange={(e) => setTranscripts(e.target.value)}
              className="h-8 font-mono text-sm"
            />
          </Field>

          <Field label="Moving Average Window" hint="0 disables smoothing">
            <Input
              type="number"
              min="0"
              value={movingAverage}
              onChange={(e) => setMovingAverage(e.target.value)}
              className="h-8 text-sm"
            />
          </Field>

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
            <Field label="UTR Color">
              <Select value={utrFill} onValueChange={setUtrFill}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURE_COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="CDS Color">
              <Select value={cdsFill} onValueChange={setCdsFill}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURE_COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Track Color" hint="Used when a single BED track is shown">
            <Select value={singleTrackColor} onValueChange={setSingleTrackColor}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRUCTURE_COLOR_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {loading ? "Running…" : "Run UTR Binding"}
          </Button>
        </div>
      </form>

      {/* ── Plot area ── */}
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        {showCarousel ? (
          <div className="flex h-full flex-col gap-3">
            {/* Nav bar */}
            <div className="flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIndex((i) => i - 1)}
                  disabled={index === 0}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-sm font-semibold">{curImage!.label}</span>
                <span className="text-xs text-muted-foreground">
                  {index + 1} / {images.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIndex((i) => i + 1)}
                  disabled={index === images.length - 1}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadPng(curImage!.url, `rnapeaks-${curImage!.label}.png`)
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadPdf(curImage!.url, curImage!.label)}
                >
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </Button>
              </div>
            </div>
            {/* Image */}
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-white dark:bg-muted/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={curImage!.url}
                src={curImage!.url}
                alt={curImage!.label}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        ) : (
          <PlotResult
            imageUrl={null}
            loading={loading}
            error={error}
            jobKind="gene"
          />
        )}
      </div>
    </div>
  )
}
