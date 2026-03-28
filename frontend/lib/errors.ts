const STATUS_MESSAGES: Record<number, string> = {
  400: "Invalid request. Please check your inputs and try again.",
  401: "Authentication error. Please refresh the page.",
  413: "File too large. Maximum allowed size is 50 MB.",
  429: "Too many requests. Please wait a moment before trying again.",
  500: "The server encountered an error. Please try again.",
  503: "The server is starting up. Please wait a moment and try again.",
}

/**
 * Returns the best user-facing error message for a failed request.
 * Prefers a meaningful server-sent message over a generic status fallback.
 */
export function friendlyError(status: number, serverMessage?: string): string {
  if (serverMessage?.trim()) {
    const s = serverMessage.trim()
    const lower = s.toLowerCase()
    if (!lower.includes("internal server error") && !lower.startsWith("<!")) {
      return s
    }
  }
  return STATUS_MESSAGES[status] ?? "Something went wrong. Please try again."
}
