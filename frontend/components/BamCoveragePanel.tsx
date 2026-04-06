"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, Plus, Trash2 } from "lucide-react"
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

const BAM_COLOR_OPTIONS = [
  { value: "steelblue", label: "Steel Blue" },
  { value: "navy", label: "Navy" },
  { value: "blue", label: "Blue" },
  { value: "red", label: "Red" },
  { value: "darkgreen", label: "Dark Green" },
  { value: "orange", label: "Orange" },
  { value: "purple", label: "Purple" },
  { value: "magenta", label: "Magenta" },
  { value: "black", label: "Black" },
  { value: "gray", label: "Gray" },
]

export interface BamEntry {
  id: string
  bamUploadId: string | null
  baiUploadId: string | null
  label: string
  fillCol: string
}

export interface BamGlobalSettings {
  fillAlpha: string
  ylimMin: string
  ylimMax: string
  trackHeight: string
  labelSize: string
  axisTextSize: string
}

interface BamCoveragePanelProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
  entries: BamEntry[]
  onEntriesChange: (entries: BamEntry[]) => void
  settings: BamGlobalSettings
  onSettingsChange: (settings: BamGlobalSettings) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
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
      <Label className="text-xs font-medium leading-none">{label}</Label>
      {children}
      {hint && (
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export function BamCoveragePanel({
  open,
  onClose,
  anchorRef,
  entries,
  onEntriesChange,
  settings,
  onSettingsChange,
}: BamCoveragePanelProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(80)
  const [mounted, setMounted] = useState(false)

  // Wait for DOM so createPortal has a target
  useEffect(() => {
    setMounted(true)
  }, [])

  // Recalculate vertical position each time the popup opens
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const maxTop = window.innerHeight - 620
    setTop(Math.max(8, Math.min(rect.top, maxTop)))
  }, [open, anchorRef])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Close when clicking outside both popup and trigger
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (
        popupRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      )
        return
      onClose()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open, onClose, anchorRef])

  if (!mounted) return null

  // The popup is always in the DOM once mounted so FileUpload components stay
  // alive (preserving upload state) across open/close cycles. Visibility is
  // controlled with `hidden` + `pointer-events-none`.
  const popup = (
    <div
      ref={popupRef}
      style={{ top, left: 332 }}
      className={[
        "fixed z-50 w-[400px]",
        "flex flex-col rounded-2xl border bg-background shadow-2xl",
        "max-h-[min(660px,90vh)]",
        open ? "" : "hidden",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
        <div>
          <p className="text-sm font-semibold tracking-tight">
            BAM Coverage Tracks
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Overlay read-depth from BAM files
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 focus:outline-none"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {entries.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No tracks yet — click Add Track below.
          </p>
        )}

        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className="space-y-3 rounded-xl border bg-muted/30 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Track {idx + 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  onEntriesChange(entries.filter((e) => e.id !== entry.id))
                }
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Remove track"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <FileUpload
              label="BAM File"
              accept=".bam"
              onUploadComplete={(id) =>
                onEntriesChange(
                  entries.map((e) =>
                    e.id === entry.id ? { ...e, bamUploadId: id } : e
                  )
                )
              }
              onClear={() =>
                onEntriesChange(
                  entries.map((e) =>
                    e.id === entry.id ? { ...e, bamUploadId: null } : e
                  )
                )
              }
            />

            <FileUpload
              label="BAI Index (.bam.bai)"
              accept=".bai"
              onUploadComplete={(id) =>
                onEntriesChange(
                  entries.map((e) =>
                    e.id === entry.id ? { ...e, baiUploadId: id } : e
                  )
                )
              }
              onClear={() =>
                onEntriesChange(
                  entries.map((e) =>
                    e.id === entry.id ? { ...e, baiUploadId: null } : e
                  )
                )
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Track Label">
                <Input
                  value={entry.label}
                  onChange={(e) =>
                    onEntriesChange(
                      entries.map((en) =>
                        en.id === entry.id
                          ? { ...en, label: e.target.value }
                          : en
                      )
                    )
                  }
                  placeholder={`Track ${idx + 1}`}
                  className="h-8 text-sm"
                />
              </Field>

              <Field label="Color">
                <Select
                  value={entry.fillCol}
                  onValueChange={(v) =>
                    onEntriesChange(
                      entries.map((en) =>
                        en.id === entry.id ? { ...en, fillCol: v } : en
                      )
                    )
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BAM_COLOR_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => {
            const next: BamEntry = {
              id: crypto.randomUUID(),
              bamUploadId: null,
              baiUploadId: null,
              label: `Track ${entries.length + 1}`,
              fillCol:
                BAM_COLOR_OPTIONS[entries.length % BAM_COLOR_OPTIONS.length]
                  .value,
            }
            onEntriesChange([...entries, next])
          }}
          disabled={entries.length >= 6}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Track
        </Button>

        {/* Global display settings */}
        <SectionLabel>Display Settings</SectionLabel>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fill Opacity" hint="0 – 1">
            <Input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={settings.fillAlpha}
              onChange={(e) =>
                onSettingsChange({ ...settings, fillAlpha: e.target.value })
              }
              className="h-8 text-sm"
            />
          </Field>
          <Field label="Track Height" hint="Relative">
            <Input
              type="number"
              min="0.5"
              step="0.5"
              value={settings.trackHeight}
              onChange={(e) =>
                onSettingsChange({ ...settings, trackHeight: e.target.value })
              }
              className="h-8 text-sm"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Label Size (pt)">
            <Input
              type="number"
              min="1"
              value={settings.labelSize}
              onChange={(e) =>
                onSettingsChange({ ...settings, labelSize: e.target.value })
              }
              className="h-8 text-sm"
            />
          </Field>
          <Field label="Axis Text (pt)">
            <Input
              type="number"
              min="1"
              value={settings.axisTextSize}
              onChange={(e) =>
                onSettingsChange({ ...settings, axisTextSize: e.target.value })
              }
              className="h-8 text-sm"
            />
          </Field>
        </div>

        <SectionLabel>Y-Axis Range</SectionLabel>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Min" hint="Blank = auto">
            <Input
              type="number"
              min="0"
              placeholder="Auto"
              value={settings.ylimMin}
              onChange={(e) =>
                onSettingsChange({ ...settings, ylimMin: e.target.value })
              }
              className="h-8 text-sm"
            />
          </Field>
          <Field label="Max" hint="Blank = auto">
            <Input
              type="number"
              min="0"
              placeholder="Auto"
              value={settings.ylimMax}
              onChange={(e) =>
                onSettingsChange({ ...settings, ylimMax: e.target.value })
              }
              className="h-8 text-sm"
            />
          </Field>
        </div>
      </div>
    </div>
  )

  return createPortal(popup, document.body)
}
