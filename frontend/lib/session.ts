const SESSION_KEY = "rna_session_id"

function generateSessionId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = generateSessionId()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}
