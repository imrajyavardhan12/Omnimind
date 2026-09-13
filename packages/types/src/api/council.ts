import { z } from 'zod'
import { providerNameSchema } from './provider-keys.js'

/**
 * Council Mode v2 shared contracts (docs/architecture/13-council-workflow.md).
 *
 * Anonymity is structural: stage-1 answers are relabeled A/B/C… before peer
 * review, and reviewers only ever see labels. Types below therefore keep
 * LABEL-space (what reviewers see) separate from MODEL-space (what the
 * orchestrator maps labels to). The ranking parser
 * (packages/ai/src/council/ranking.ts) operates purely in label-space.
 */

export const councilRunStatusSchema = z.enum([
  'queued',
  'stage1',
  'stage2',
  'stage3',
  'completed',
  'failed',
  'cancelled',
])
export type CouncilRunStatus = z.infer<typeof councilRunStatusSchema>

export const councilStageSchema = z.enum(['stage1', 'stage2', 'stage3'])
export type CouncilStage = z.infer<typeof councilStageSchema>

export const councilStageResultStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
])
export type CouncilStageResultStatus = z.infer<typeof councilStageResultStatusSchema>

/** One council member: provider + model selected by the user. */
export const councilMemberSchema = z.object({
  provider: providerNameSchema,
  model: z.string().min(1),
})
export type CouncilMember = z.infer<typeof councilMemberSchema>

/** POST /v1/council/runs — create a durable council workflow. */
export const createCouncilRunRequestSchema = z.object({
  query: z.string().min(1).max(50_000),
  councilModels: z.array(councilMemberSchema).min(2).max(5),
  chairmanModel: councilMemberSchema,
  conversationId: z.string().uuid().optional(),
})
export type CreateCouncilRunRequest = z.infer<typeof createCouncilRunRequestSchema>

export const createCouncilRunResponseSchema = z.object({
  runId: z.string().uuid(),
  eventStreamUrl: z.string(),
})
export type CreateCouncilRunResponse = z.infer<typeof createCouncilRunResponseSchema>

/** An anonymized answer label (A, B, C, …) — the only identity reviewers see. */
export const answerLabelSchema = z
  .string()
  .regex(/^[A-Z]$/, 'Answer label must be a single uppercase letter')
export type AnswerLabel = z.infer<typeof answerLabelSchema>

/** One parsed rank entry, in label-space. */
export const rankEntrySchema = z.object({
  label: answerLabelSchema,
  rank: z.number().int().positive(),
})
export type RankEntry = z.infer<typeof rankEntrySchema>

/**
 * A reviewer's parsed ballot. `fallback` (with reason) means the review text
 * had no usable FINAL RANKING section, so identity order was used — stored
 * explicitly so aggregate quality stays auditable (13-council-workflow.md).
 */
export const parsedBallotSchema = z.object({
  reviewerLabel: answerLabelSchema,
  entries: z.array(rankEntrySchema),
  parseStatus: z.enum(['parsed', 'fallback']),
  fallbackReason: z.string().optional(),
  /** Prompt template id + version that produced the review (quality tracking). */
  promptTemplateId: z.string().optional(),
  promptTemplateVersion: z.string().optional(),
})
export type ParsedBallot = z.infer<typeof parsedBallotSchema>

/** Per-answer aggregate across all reviewer ballots. */
export const answerAggregateSchema = z.object({
  label: answerLabelSchema,
  /** Borda points: with N answers, rank r earns N - r points per ballot. */
  bordaPoints: z.number().int().nonnegative(),
  averageRank: z.number().positive(),
  reviewCount: z.number().int().nonnegative(),
})
export type AnswerAggregate = z.infer<typeof answerAggregateSchema>

/** Stage-3 output: sorted aggregates (best first) plus the raw ballots. */
export const aggregateResultSchema = z.object({
  aggregates: z.array(answerAggregateSchema),
  ballots: z.array(parsedBallotSchema),
  method: z.literal('borda_plus_average_rank'),
})
export type AggregateResult = z.infer<typeof aggregateResultSchema>

// --- council stream event data shapes (enveloped by StreamEnvelope, 09) ---

export const councilStartedDataSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  councilSize: z.number().int().positive(),
})
export type CouncilStartedData = z.infer<typeof councilStartedDataSchema>

export const councilStageStartedDataSchema = z.object({
  stage: councilStageSchema,
})
export type CouncilStageStartedData = z.infer<typeof councilStageStartedDataSchema>

export const councilModelEventDataSchema = z.object({
  modelRunId: z.string(),
  provider: z.string(),
  model: z.string(),
  /** Anonymized label for stage-1 answers (absent for chairman synthesis). */
  label: answerLabelSchema.optional(),
})
export type CouncilModelEventData = z.infer<typeof councilModelEventDataSchema>

export const councilRankingCompletedDataSchema = z.object({
  ballot: parsedBallotSchema,
})
export type CouncilRankingCompletedData = z.infer<typeof councilRankingCompletedDataSchema>

export const councilAggregateCompletedDataSchema = z.object({
  result: aggregateResultSchema,
})
export type CouncilAggregateCompletedData = z.infer<typeof councilAggregateCompletedDataSchema>

export const councilFailedDataSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().optional(),
  }),
})
export type CouncilFailedData = z.infer<typeof councilFailedDataSchema>

export const COUNCIL_EVENT_TYPES = [
  'council.started',
  'council.stage.started',
  'council.stage.completed',
  'council.model.started',
  'council.model.completed',
  'council.model.failed',
  'council.ranking.completed',
  'council.aggregate.completed',
  'council.synthesis.delta',
  'council.completed',
  'council.failed',
  'council.cancelled',
] as const
export type CouncilEventType = (typeof COUNCIL_EVENT_TYPES)[number]
