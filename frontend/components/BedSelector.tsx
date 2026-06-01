"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileUpload } from "@/components/FileUpload"

export type BedBuiltin = "K562" | "HepG2"

export interface BedUpload {
  id: string // local row id
  uploadId: string | null
  label: string
}

export interface BedSelection {
  builtins: BedBuiltin[]
  uploads: BedUpload[]
}

export const EMPTY_BED_SELECTION: BedSelection = {
  builtins: ["K562"],
  uploads: [],
}

const BUILTINS: BedBuiltin[] = ["K562", "HepG2"]

// True once at least one BED source is fully specified.
export function hasBed(sel: BedSelection): boolean {
  return (
    sel.builtins.length > 0 || sel.uploads.some((u) => !!u.uploadId)
  )
}

// Flatten the selection into the comma-separated params the run* helpers
// expect. Only uploads with a completed upload are included.
export function bedParams(sel: BedSelection): {
  bedSources: string
  bedUploadIds: string
  bedLabels: string
} {
  const ready = sel.uploads.filter((u) => u.uploadId)
  return {
    bedSources: sel.builtins.join(","),
    bedUploadIds: ready.map((u) => u.uploadId!).join(","),
    bedLabels: ready.map((u) => u.label.replace(/,/g, " ")).join(","),
  }
}

interface BedSelectorProps {
  value: BedSelection
  onChange: (v: BedSelection) => void
}

export function BedSelector({ value, onChange }: BedSelectorProps) {
  function toggleBuiltin(b: BedBuiltin) {
    onChange({
      ...value,
      builtins: value.builtins.includes(b)
        ? value.builtins.filter((x) => x !== b)
        : [...value.builtins, b],
    })
  }

  function updateUpload(id: string, patch: Partial<BedUpload>) {
    onChange({
      ...value,
      uploads: value.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    })
  }

  function removeUpload(id: string) {
    onChange({ ...value, uploads: value.uploads.filter((u) => u.id !== id) })
  }

  function addUpload() {
    onChange({
      ...value,
      uploads: [
        ...value.uploads,
        {
          id: crypto.randomUUID(),
          uploadId: null,
          label: `BED ${value.uploads.length + 1}`,
        },
      ],
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-medium">Built-in BED Files</p>
        <div className="flex gap-4">
          {BUILTINS.map((b) => (
            <label key={b} className="flex cursor-pointer items-center gap-1.5">
              <Checkbox
                checked={value.builtins.includes(b)}
                onCheckedChange={() => toggleBuiltin(b)}
              />
              <span className="text-sm">{b}</span>
            </label>
          ))}
        </div>
      </div>

      {value.uploads.map((u, idx) => (
        <div
          key={u.id}
          className="space-y-2 rounded-lg border bg-muted/30 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase">
              Upload {idx + 1}
            </span>
            <button
              type="button"
              onClick={() => removeUpload(u.id)}
              className="text-muted-foreground transition-colors hover:text-destructive"
              aria-label="Remove BED"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <FileUpload
            label=""
            accept=".bed"
            onUploadComplete={(id) => updateUpload(u.id, { uploadId: id })}
            onClear={() => updateUpload(u.id, { uploadId: null })}
          />

          <div className="space-y-1.5">
            <Label className="text-xs leading-none font-medium">Label</Label>
            <Input
              value={u.label}
              onChange={(e) => updateUpload(u.id, { label: e.target.value })}
              placeholder={`BED ${idx + 1}`}
              className="h-8 text-sm"
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={addUpload}
        disabled={value.uploads.length >= 6}
      >
        <Plus className="h-3.5 w-3.5" />
        Add BED file
      </Button>
    </div>
  )
}
