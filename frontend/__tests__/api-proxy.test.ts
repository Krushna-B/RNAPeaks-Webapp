import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

const TEST_SECRET = "test_session_secret_32_chars_xxxx"

async function makeSessionToken(secret: string): Promise<string> {
  const nonce = "abcdef1234567890abcdef1234567890"
  const ts = Math.floor(Date.now() / 1000).toString()
  const payload = `${nonce}|${ts}`
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload))
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `${payload}|${sigHex}`
}

describe("API Proxy Route", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns 503 when HF_SPACE_URL is not configured", async () => {
    delete process.env.HF_SPACE_URL

    const { POST } = await import("../app/api/[...path]/route")
    const req = new NextRequest("http://localhost/api/health")
    const res = await POST(req, { params: Promise.resolve({ path: ["health"] }) })

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe("Backend not configured")
  })

  it("forwards request to backend with Authorization header when token is set", async () => {
    process.env.HF_SPACE_URL = "https://test.hf.space"
    process.env.HF_SECRET_TOKEN = "hf_test_token"
    process.env.SESSION_SECRET = TEST_SECRET

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", mockFetch)

    const token = await makeSessionToken(TEST_SECRET)
    const { POST } = await import("../app/api/[...path]/route")
    const req = new NextRequest("http://localhost/api/health", {
      method: "POST",
      headers: { "X-Session-Token": token },
    })
    await POST(req, { params: Promise.resolve({ path: ["health"] }) })

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.hf.space/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer hf_test_token",
        }),
      })
    )
  })

  it("proxies backend error status back to client", async () => {
    process.env.HF_SPACE_URL = "https://test.hf.space"
    process.env.SESSION_SECRET = TEST_SECRET
    delete process.env.HF_SECRET_TOKEN

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 }))
    )

    const token = await makeSessionToken(TEST_SECRET)
    const { POST } = await import("../app/api/[...path]/route")
    const req = new NextRequest("http://localhost/api/plot-gene", {
      method: "POST",
      headers: { "X-Session-Token": token },
    })
    const res = await POST(req, { params: Promise.resolve({ path: ["plot-gene"] }) })

    expect(res.status).toBe(500)
  })
})
