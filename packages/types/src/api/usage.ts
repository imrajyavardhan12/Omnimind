import { z } from 'zod'
import { providerNameSchema } from './provider-keys.js'

const isoDateTime = z.string().datetime({ offset: true })

/** GET /v1/usage — aggregated spend for a date window (defaults: current UTC month). */
export const usageSummaryQuerySchema = z
  .object({
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: 'from must not be after to' })
export type UsageSummaryQuery = z.infer<typeof usageSummaryQuerySchema>

export const usageBucketSchema = z.object({
  provider: z.string(),
  model: z.string(),
  costUsd: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  totalTokens: z.number().int(),
  runs: z.number().int(),
})
export type UsageBucket = z.infer<typeof usageBucketSchema>

export const usageDailyPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  costUsd: z.string(),
  totalTokens: z.number().int(),
  runs: z.number().int(),
})
export type UsageDailyPoint = z.infer<typeof usageDailyPointSchema>

export const usageSummarySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  totalCostUsd: z.string(),
  totalInputTokens: z.number().int(),
  totalOutputTokens: z.number().int(),
  totalTokens: z.number().int(),
  totalRuns: z.number().int(),
  byModel: z.array(usageBucketSchema),
  daily: z.array(usageDailyPointSchema),
})
export type UsageSummary = z.infer<typeof usageSummarySchema>

/** GET /v1/usage/ledger — raw append-only entries, newest first. */
export const usageLedgerQuerySchema = z.object({
  provider: providerNameSchema.optional(),
  model: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
export type UsageLedgerQuery = z.infer<typeof usageLedgerQuerySchema>

export const usageLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  totalTokens: z.number().int(),
  usageSource: z.string(),
  costUsd: z.string(),
  conversationId: z.string().uuid().nullable(),
  chatRunId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
})
export type UsageLedgerEntryResponse = z.infer<typeof usageLedgerEntrySchema>
