// Server-only helpers for the KATSS proxy routes.
//
// KATSS runs on Render's free tier behind Cloudflare, so it spins down when
// idle and the first requests after a wake can stall past undici's 10s connect
// timeout, surfacing as a generic "fetch failed". These transient blips are
// absorbed here with a per-attempt timeout and a few retries on idempotent
// (GET) requests, so a single hiccup does not fail a whole job.

import * as Sentry from "@sentry/nextjs"

export const KATSS_API_URL =
  process.env.KATSS_API_URL ?? "https://katsswebserver.onrender.com"

// Report a KATSS backend HTTP error to Sentry. Only 5xx (the job server itself
// is broken) is alert-worthy; 4xx is caller error and passes through silently.
export function captureKatssBackendError(
  endpoint: string,
  status: number,
  body: string
): void {
  if (status < 500) return
  Sentry.captureMessage(`KATSS backend ${status} on ${endpoint}`, {
    level: "error",
    extra: { endpoint, status, responseBody: body.slice(0, 500) },
    tags: {
      layer: "katss",
      error_type: "backend_5xx",
      status: String(status),
    },
  })
}

interface KatssFetchOptions {
  retries?: number
  timeoutMs?: number
}

export async function katssFetch(
  url: string,
  init: RequestInit = {},
  { retries = 2, timeoutMs = 20000 }: KatssFetchOptions = {}
): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      lastErr = err
      // Back off briefly before retrying a transient network failure.
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }
  // All retries exhausted — the KATSS server is genuinely unreachable, not just
  // a transient blip the retries absorbed. Alert once, here, so every caller
  // route is covered without repeating the capture block.
  Sentry.captureException(lastErr, {
    level: "error",
    extra: { url, attempts: retries + 1 },
    tags: { layer: "katss", error_type: "network" },
  })
  throw lastErr
}
