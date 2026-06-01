"use client"

import { AlertCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { ControlPeaksResult } from "@/lib/api"

const PREVIEW_ROWS = 100

function toCsv(columns: string[], rows: Record<string, string | number>[]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? "")
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.join(",")
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(",")).join("\n")
  return `${header}\n${body}\n`
}

// BED of the sampled control regions: chr, control_start, control_end, name, ., strand.
function toBed(rows: Record<string, string | number>[]): string {
  return (
    rows
      .map((r) =>
        [
          r.chr,
          r.control_start,
          r.control_end,
          r.name ?? ".",
          ".",
          r.strand ?? ".",
        ].join("\t")
      )
      .join("\n") + "\n"
  )
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface TableResultProps {
  result: ControlPeaksResult | null
  loading: boolean
  error: string | null
}

export function TableResult({ result, loading, error }: TableResultProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-sm space-y-3">
          <Progress value={undefined} className="h-1.5" />
          <p className="text-center text-xs text-muted-foreground">
            Sampling region-matched control peaks…
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6">
        <AlertCircle className="h-8 w-8 shrink-0 text-destructive/70" />
        <p className="max-w-sm text-center text-sm leading-relaxed text-destructive">
          {error}
        </p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-muted/10">
        <p className="text-sm text-muted-foreground">
          Control peaks will appear here
        </p>
      </div>
    )
  }

  const { total, columns, rows } = result
  const preview = rows.slice(0, PREVIEW_ROWS)
  const hasControlRegion =
    columns.includes("control_start") && columns.includes("control_end")

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString()} control peaks
          {rows.length > PREVIEW_ROWS && ` · showing first ${PREVIEW_ROWS}`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              download(
                "control-peaks.csv",
                toCsv(columns, rows),
                "text/csv"
              )
            }
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          {hasControlRegion && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                download(
                  "control-peaks.bed",
                  toBed(rows),
                  "text/plain"
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              BED
            </Button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border bg-white dark:bg-muted/10">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="border-b px-3 py-2 text-left font-semibold whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="even:bg-muted/20">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-1.5 font-mono whitespace-nowrap">
                    {String(row[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
