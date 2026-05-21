import { z } from 'zod'
import { providerNameSchema } from './provider-keys.js'

// Cross-boundary stream contract used by API + web. Plaintext provider keys
// and AbortSignal live only in the runtime gateway types in packages/ai —
// they MUST NOT appear on this serializable schema.

export const gatewayMessageRoleSchema = z.enum(['system', 'user', 'assistant'])
export type GatewayMessageRole = z.infer<typeof gatewayMessageRoleSchema>

export const gatewayMessageSchema = z.object({
  role: gatewayMessageRoleSchema,
  content: z.string(),
})
export type GatewayMessage = z.infer<typeof gatewayMessageSchema>

export const gatewayRequestSchema = z.object({
  provider: providerNameSchema,
  model: z.string().min(1),
  messages: z.array(gatewayMessageSchema).min(1),
  system: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
})
export type GatewayRequestInput = z.infer<typeof gatewayRequestSchema>

export const gatewayErrorCodeSchema = z.enum([
  'MODEL_NOT_FOUND',
  'MODEL_DISABLED',
  'MODEL_DEPRECATED',
  'MODEL_CAPABILITY_UNSUPPORTED',
  'MAX_OUTPUT_TOKENS_EXCEEDED',
  'PROVIDER_AUTH_FAILED',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_ERROR',
  'CONTEXT_TOO_LARGE',
  'CONTENT_FILTERED',
  'CANCELLED',
  'UNKNOWN_PROVIDER_ERROR',
])
export type GatewayErrorCode = z.infer<typeof gatewayErrorCodeSchema>

export const gatewayErrorSchema = z.object({
  code: gatewayErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean().optional(),
})
export type GatewayError = z.infer<typeof gatewayErrorSchema>

export const normalizedUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
  cachedInputTokens: z.number().int().nonnegative().optional(),
})
export type NormalizedUsage = z.infer<typeof normalizedUsageSchema>

// Usage is end-of-stream only; deltas never carry token counts.
export const gatewayStreamChunkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), delta: z.string() }),
  z.object({
    type: z.literal('done'),
    finishReason: z.string().optional(),
    usage: normalizedUsageSchema.optional(),
  }),
  z.object({ type: z.literal('error'), error: gatewayErrorSchema }),
])
export type GatewayStreamChunk = z.infer<typeof gatewayStreamChunkSchema>
