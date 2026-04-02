const SESSION_KEY = "rna_session_token"

export async function getSessionToken(): Promise<string> {
  const cached = sessionStorage.getItem(SESSION_KEY)
  if (cached) return cached

  const res = await fetch("/api/session")
  if (!res.ok) throw new Error("Failed to initialize session. Please refresh the page.")
  const { token } = await res.json()
  sessionStorage.setItem(SESSION_KEY, token)
  return token
}
