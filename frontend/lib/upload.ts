import { getSessionId } from "@/lib/session"

export function uploadFile(
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append("file", file, file.name)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload")
    xhr.setRequestHeader("X-Session-ID", getSessionId())

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve(data.upload_id)
        } catch {
          reject(new Error("Invalid response from server"))
        }
      } else {
        let message = xhr.responseText
        try {
          message = JSON.parse(xhr.responseText).error ?? xhr.responseText
        } catch {
          /* use raw text */
        }
        reject(new Error(message || `Upload failed (${xhr.status})`))
      }
    }

    xhr.onerror = () => reject(new Error("Network error during upload"))
    xhr.send(form)
  })
}
