import { z } from 'zod'
import { normalizedUsageSchema } from './llm-gateway.js'

// --- Stream envelope ---

export const streamEnvelopeSchema = <TType extends string, TData extends z.ZodTypeAny>(
  type: TType,
  dataSchema: TData,
) =>
  z.object({
    type: z.literal(type),
    runId: z.string(),
    sequence: z.number().int().nonnegative(),
    timestamp: z.string(),
    data: dataSchema,
  })

export interface StreamEnvelope<TType extends string, TData> {
  type: TType
  runId: string
  sequence: number
  timestamp: string
  data: TData
}

// --- Run events ---

export const runStartedDataSchema = z.object({
  conversationId: z.string(),
})
export type RunStartedData = z.infer<typeof runStartedDataSchema>

export const runCompletedDataSchema = z.object({})
export type RunCompletedData = z.infer<typeof runCompletedDataSchema>

export const runFailedDataSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
})
export type RunFailedData = z.infer<typeof runFailedDataSchema>

export const runCancelledDataSchema = z.object({})
export type RunCancelledData = z.infer<typeof runCancelledDataSchema>

// --- Model run events ---

export const modelQueuedDataSchema = z.object({
  modelRunId: z.string(),
  provider: z.string(),
  model: z.string(),
})
export type ModelQueuedData = z.infer<typeof modelQueuedDataSchema>

export const modelStartedDataSchema = z.object({
  modelRunId: z.string(),
  provider: z.string(),
  model: z.string(),
})
export type ModelStartedData = z.infer<typeof modelStartedDataSchema>

export const modelDeltaDataSchema = z.object({
  modelRunId: z.string(),
  text: z.string(),
})
export type ModelDeltaData = z.infer<typeof modelDeltaDataSchema>

export const modelRetryingDataSchema = z.object({
  modelRunId: z.string(),
  attempt: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  delayMs: z.number().int().nonnegative(),
  reason: z.string(),
})
export type ModelRetryingData = z.infer<typeof modelRetryingDataSchema>

export const modelCompletedDataSchema = z.object({
  modelRunId: z.string(),
  finishReason: z.string().optional(),
  usage: normalizedUsageSchema.optional(),
  costUsd: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
})
export type ModelCompletedData = z.infer<typeof modelCompletedDataSchema>

export const modelFailedDataSchema = z.object({
  modelRunId: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().optional(),
    provider: z.string().optional(),
    providerStatusCode: z.number().optional(),
  }),
})
export type ModelFailedData = z.infer<typeof modelFailedDataSchema>

export const modelCancelledDataSchema = z.object({
  modelRunId: z.string(),
})
export type ModelCancelledData = z.infer<typeof modelCancelledDataSchema>

// --- Usage events ---

export const usageUpdatedDataSchema = z.object({
  usage: normalizedUsageSchema,
  costUsd: z.string().optional(),
})
export type UsageUpdatedData = z.infer<typeof usageUpdatedDataSchema>

// --- System events ---

export const heartbeatDataSchema = z.object({})
export type HeartbeatData = z.infer<typeof heartbeatDataSchema>

export const errorDataSchema = z.object({
  code: z.string(),
  message: z.string(),
})
export type ErrorData = z.infer<typeof errorDataSchema>

// --- Event type union ---

export type StreamEventType =
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled'
  | 'model.queued'
  | 'model.started'
  | 'model.delta'
  | 'model.retrying'
  | 'model.completed'
  | 'model.failed'
  | 'model.cancelled'
  | 'usage.updated'
  | 'heartbeat'
  | 'error'

export type RunStartedEvent = StreamEnvelope<'run.started', RunStartedData>
export type RunCompletedEvent = StreamEnvelope<'run.completed', RunCompletedData>
export type RunFailedEvent = StreamEnvelope<'run.failed', RunFailedData>
export type RunCancelledEvent = StreamEnvelope<'run.cancelled', RunCancelledData>
export type ModelQueuedEvent = StreamEnvelope<'model.queued', ModelQueuedData>
export type ModelStartedEvent = StreamEnvelope<'model.started', ModelStartedData>
export type ModelDeltaEvent = StreamEnvelope<'model.delta', ModelDeltaData>
export type ModelRetryingEvent = StreamEnvelope<'model.retrying', ModelRetryingData>
export type ModelCompletedEvent = StreamEnvelope<'model.completed', ModelCompletedData>
export type ModelFailedEvent = StreamEnvelope<'model.failed', ModelFailedData>
export type ModelCancelledEvent = StreamEnvelope<'model.cancelled', ModelCancelledData>
export type UsageUpdatedEvent = StreamEnvelope<'usage.updated', UsageUpdatedData>
export type HeartbeatEvent = StreamEnvelope<'heartbeat', HeartbeatData>
export type ErrorEvent = StreamEnvelope<'error', ErrorData>

export type StreamEvent =
  | RunStartedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | RunCancelledEvent
  | ModelQueuedEvent
  | ModelStartedEvent
  | ModelDeltaEvent
  | ModelRetryingEvent
  | ModelCompletedEvent
  | ModelFailedEvent
  | ModelCancelledEvent
  | UsageUpdatedEvent
  | HeartbeatEvent
  | ErrorEvent
