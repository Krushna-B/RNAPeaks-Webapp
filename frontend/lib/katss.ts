import { friendlyError } from "@/lib/errors"

export type KatssStatus = "pending" | "running" | "completed" | "failed"

export interface KatssJobParams {
  testFile: File
  controlFile?: File | null
  kmer?: string
  iterations?: string
  delimiter?: string
  enrichments?: boolean
  shuffle?: boolean
  independentProbs?: boolean
  bootstrap?: string
  sample?: string
  seed?: string
  klet?: string
}

export interface KatssSubmitResponse {
  job_id: string
  status: KatssStatus
  message?: string
}

export interface KatssStatusResponse {
  job_id: string
  status: KatssStatus
  created_at?: string
  started_at?: string | null
  completed_at?: string | null
  progress?: number | null
  error_message?: string | null
}

export interface KatssVisualization {
  filename: string
  label: string
  url: string
}

export interface KatssResults {
  job_id: string
  status: KatssStatus
  csv_url: string | null
  visualizations: KatssVisualization[]
  summary_statistics: Record<string, unknown> | null
  error_message: string | null
}

async function readError(res: Response): Promise<string> {
  let serverMessage: string | undefined
  try {
    const body = await res.json()
    const raw = body.error
    serverMessage = Array.isArray(raw) ? raw[0] : raw
  } catch {
    /* ignore */
  }
  return friendlyError(res.status, serverMessage)
}

// Only append optional params that were actually set, so KATSS falls back to
// its own defaults for anything left blank.
function appendOptional(form: FormData, key: string, value?: string) {
  if (value !== undefined && value.trim() !== "") form.append(key, value.trim())
}

export async function submitKatssJob(
  params: KatssJobParams
): Promise<KatssSubmitResponse> {
  const form = new FormData()
  form.append("test_file", params.testFile)
  if (params.controlFile) form.append("control_file", params.controlFile)

  appendOptional(form, "kmer", params.kmer)
  appendOptional(form, "iterations", params.iterations)
  appendOptional(form, "delimiter", params.delimiter)
  appendOptional(form, "bootstrap", params.bootstrap)
  appendOptional(form, "sample", params.sample)
  appendOptional(form, "seed", params.seed)
  appendOptional(form, "klet", params.klet)
  // `enrichments` selects the algorithm (true = Regular / all k-mers, false =
  // IKKE / iterative knockout). Verified against the live API. Always sent
  // explicitly because the UI default (Regular) is the opposite of the API's
  // omitted-param default (IKKE).
  form.append("enrichments", params.enrichments ? "true" : "false")
  if (params.shuffle) form.append("shuffle", "true")
  if (params.independentProbs) form.append("independent_probs", "true")

  const res = await fetch("/api/katss/submit", { method: "POST", body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<KatssSubmitResponse>
}

export async function getKatssJobStatus(
  jobId: string
): Promise<KatssStatusResponse> {
  const res = await fetch(`/api/katss/jobs/${jobId}/status`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<KatssStatusResponse>
}

export async function getKatssResults(jobId: string): Promise<KatssResults> {
  const res = await fetch(`/api/katss/results/${jobId}`, { cache: "no-store" })
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<KatssResults>
}
