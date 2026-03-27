import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

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

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", mockFetch)

    const { POST } = await import("../app/api/[...path]/route")
    const req = new NextRequest("http://localhost/api/health", { method: "POST" })
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
    delete process.env.HF_SECRET_TOKEN

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 }))
    )

    const { POST } = await import("../app/api/[...path]/route")
    const req = new NextRequest("http://localhost/api/plot-gene", { method: "POST" })
    const res = await POST(req, { params: Promise.resolve({ path: ["plot-gene"] }) })

    expect(res.status).toBe(500)
  })
})
