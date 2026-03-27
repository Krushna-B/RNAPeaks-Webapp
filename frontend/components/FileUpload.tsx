"use client"

import { useRef, useState } from "react"
import { UploadCloud, X, CheckCircle2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { generateUploadId, uploadFileInChunks } from "@/lib/upload"

interface FileUploadProps {
  label: string
  accept?: string
  onUploadComplete: (uploadId: string, file: File) => void
  onClear?: () => void
}

export function FileUpload({ label, accept, onUploadComplete, onClear }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    setProgress(0)
    setUploadedFile(null)

    const uploadId = generateUploadId()

    try {
      await uploadFileInChunks(file, uploadId, setProgress)
      setUploadedFile(file)
      onUploadComplete(uploadId, file)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function handleClear() {
    setUploadedFile(null)
    setProgress(0)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
    onClear?.()
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>

      {!uploadedFile && !uploading && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Drag & drop or <span className="text-primary font-medium">browse</span>
          </p>
          {accept && (
            <p className="text-xs text-muted-foreground">{accept.replace(/\./g, "").toUpperCase()} files supported</p>
          )}
        </div>
      )}

      {uploading && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <p className="text-sm text-muted-foreground truncate">Uploading...</p>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{progress}%</p>
        </div>
      )}

      {uploadedFile && !uploading && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(uploadedFile.size)}</p>
            </div>
          </div>
          <button onClick={handleClear} className="ml-2 text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
