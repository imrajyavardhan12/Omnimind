import { apiFetch, apiFetchRaw } from '@/lib/api/client'
import type {
  AggregateResult,
  CouncilMember,
  CouncilRunStatus,
  CreateCouncilRunRequest,
  ParsedBallot,
} from '@omnimind/types'

/** Council run row as returned by GET /v1/council/runs/:runId (drizzle shape). */
export interface CouncilRunDto {
  id: string
  workspaceId: string
  conversationId: string | null
  query: string
  chairmanProvider: string
  chairmanModel: string
  status: CouncilRunStatus
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

/** Stage-result row as returned by GET detail (drizzle shape). */
export interface CouncilStageResultDto {
  id: string
  councilRunId: string
  stage: 'stage1' | 'stage2' | 'stage3'
  modelProvider: string | null
  modelId: string | null
  payloadJson: StagePayload | null
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
}

/** Discriminated stage payloads written by the backend orchestrator. */
export type StagePayload =
  | {
      kind: 'stage1_answer'
      label: string
      provider: string
      model: string
      text: string
      costUsd: string
      latencyMs: number
    }
  | {
      kind: 'stage2_review'
      reviewerLabel: string
      reviewerProvider: string
      reviewerModel: string
      reviewText: string
      ballot: ParsedBallot
      costUsd: string
      latencyMs: number
    }
  | { kind: 'aggregate'; result: AggregateResult }
  | { kind: 'synthesis'; text: string; costUsd: string; latencyMs: number }
  | { kind: 'failed'; error: { code: string; message: string } }

export interface GetCouncilRunResponse {
  run: CouncilRunDto
  stageResults: CouncilStageResultDto[]
}

/**
 * Thin typed client over the backend council workflow (apps/api council.ts).
 * The browser submits the query + model SELECTIONS only — never provider keys,
 * never direct provider calls (14-security.md, AGENTS.md §6).
 */
export const councilApi = {
  createRun: (
    input: Pick<CreateCouncilRunRequest, 'query' | 'councilModels' | 'chairmanModel'> & {
      councilModels: CouncilMember[]
      chairmanModel: CouncilMember
    },
    token: string,
  ) =>
    apiFetch<{ runId: string; eventStreamUrl: string }>('/v1/council/runs', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }),

  getRun: (runId: string, token: string) =>
    apiFetch<GetCouncilRunResponse>(`/v1/council/runs/${runId}`, { token }),

  cancelRun: (runId: string, token: string) =>
    apiFetch<{ status: CouncilRunStatus }>(`/v1/council/runs/${runId}/cancel`, {
      method: 'POST',
      token,
    }),

  /**
   * Open the live-only SSE event stream as a raw Response (consume with
   * `readRunEventStream` from the shared chat SSE client). No `afterSequence`:
   * council streams do not replay — state comes from `getRun` (the backend
   * answers 400 on `afterSequence`). Uses apiFetchRaw so the Clerk bearer
   * token rides as a header — EventSource cannot do this.
   */
  openEventStream: (runId: string, token: string, opts: { signal?: AbortSignal } = {}): Promise<Response> =>
    apiFetchRaw(`/v1/council/runs/${runId}/events`, {
      method: 'GET',
      token,
      ...(opts.signal ? { signal: opts.signal } : {}),
    }),
}
