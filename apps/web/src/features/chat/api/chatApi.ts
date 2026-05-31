import { apiFetch, apiFetchRaw } from '@/lib/api/client'
import type {
  ChatModelRunStatus,
  ChatRunStatus,
  CreateRunRequest,
  CreateRunResponse,
} from '@omnimind/types'

/** Run detail as returned by GET /v1/chat/runs/:runId (drizzle row shape). */
export interface ChatRunDto {
  id: string
  conversationId: string
  mode: 'single' | 'compare'
  status: ChatRunStatus
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface ChatModelRunDto {
  id: string
  chatRunId: string
  provider: string
  model: string
  status: ChatModelRunStatus
  outputMessageId: string | null
  errorCode: string | null
  errorMessage: string | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  usageSource: 'provider' | 'estimated' | null
  costUsd: string | null
  latencyMs: number | null
}

export interface GetRunResponse {
  run: ChatRunDto
  modelRuns: ChatModelRunDto[]
}

/**
 * Thin typed client over the backend chat run engine (apps/api chat-runs.ts).
 * The browser submits provider+model SELECTIONS only — never provider keys,
 * never direct provider calls (14-security.md, AGENTS.md §6).
 */
export const chatApi = {
  /**
   * Create one durable run. `idempotencyKey` is sent as the `Idempotency-Key`
   * HEADER (not a body field) — reuse the same key for a retried submit so a
   * network blip cannot create a duplicate run.
   */
  createRun: (input: CreateRunRequest, idempotencyKey: string, token: string) =>
    apiFetch<CreateRunResponse>('/v1/chat/runs', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  getRun: (runId: string, token: string) =>
    apiFetch<GetRunResponse>(`/v1/chat/runs/${runId}`, { token }),

  cancelRun: (runId: string, token: string) =>
    apiFetch<{ status: ChatRunStatus }>(`/v1/chat/runs/${runId}/cancel`, {
      method: 'POST',
      token,
    }),

  /**
   * Open the SSE event stream as a raw Response (use `readRunEventStream` to
   * consume it). Uses apiFetchRaw so the Clerk bearer token rides as a header —
   * EventSource cannot do this, which is why fetch+reader is mandatory.
   */
  openEventStream: (
    runId: string,
    token: string,
    opts: { afterSequence?: number; signal?: AbortSignal } = {},
  ): Promise<Response> => {
    const query = opts.afterSequence !== undefined ? `?afterSequence=${opts.afterSequence}` : ''
    return apiFetchRaw(`/v1/chat/runs/${runId}/events${query}`, {
      method: 'GET',
      token,
      ...(opts.signal ? { signal: opts.signal } : {}),
    })
  },
}
