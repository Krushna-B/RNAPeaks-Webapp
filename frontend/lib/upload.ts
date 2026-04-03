import { getSessionToken } from "@/lib/session"
import { friendlyError } from "@/lib/errors"

interface UploadCredentials {
  token: string
  sessionId: string
  url: string
}

// Step 1: Ask the Next.js server for a short-lived upload token.
// The server verifies the session and mints an HMAC token without
// ever exposing HF_SECRET_TOKEN to the browser.
async function getUploadCredentials(): Promise<UploadCredentials> {
  const sessionToken = await getSessionToken()
  const res = await fetch("/api/upload-token", {
    headers: { "X-Session-Token": sessionToken },
  })
  if (!res.ok) {
    throw new Error("Could not get upload credentials. Please refresh and try again.")
  }
  return res.json()
}

// Step 2: POST the file directly to HF Space — Vercel is not in this path,
// so there is no body size limit. Progress reporting works the same way
// because we still use XHR.
export async function uploadFile(
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  const { token, sessionId, url } = await getUploadCredentials()

  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append("file", file, file.name)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.setRequestHeader("X-Session-ID", sessionId)

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
        let serverMessage: string | undefined
        try {
          serverMessage = JSON.parse(xhr.responseText).error
        } catch { /* ignore */ }
        reject(new Error(friendlyError(xhr.status, serverMessage)))
      }
    }

    xhr.onerror = () =>
      reject(new Error("Could not reach the server. Please check your connection and try again."))
    xhr.send(form)
  })
}
