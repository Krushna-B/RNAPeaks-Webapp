const CHUNK_SIZE = 10 * 1024 * 1024 // 10 MB

export function generateUploadId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export async function uploadFileInChunks(
  file: File,
  uploadId: string,
  onProgress: (pct: number) => void
): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const form = new FormData()
    form.append("upload_id", uploadId)
    form.append("chunk_index", String(i))
    form.append("total_chunks", String(totalChunks))
    form.append("chunk", chunk, file.name)

    const res = await fetch(`/api/upload/chunk`, {
      method: "POST",
      body: form,
    })

    if (!res.ok) {
      throw new Error(`Chunk ${i} failed: ${await res.text()}`)
    }

    onProgress(Math.round(((i + 1) / totalChunks) * 100))
  }
}
