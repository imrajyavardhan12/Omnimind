import { z } from 'zod'
import { providerNameSchema } from './provider-keys.js'

export const chatRunModelConfigSchema = z.object({
  provider: providerNameSchema,
  model: z.string().min(1),
  settings: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxOutputTokens: z.number().int().positive().optional(),
      systemPrompt: z.string().optional(),
    })
    .optional(),
})
export type ChatRunModelConfig = z.infer<typeof chatRunModelConfigSchema>

export const createRunRequestSchema = z.object({
  conversationId: z.string().uuid(),
  input: z.object({
    text: z.string().min(1).max(50_000),
    attachmentIds: z.array(z.string().uuid()).optional(),
  }),
  models: z.array(chatRunModelConfigSchema).min(1).max(5),
  context: z
    .object({
      messageLimit: z.number().int().positive().max(200).optional(),
    })
    .optional(),
})
export type CreateRunRequest = z.infer<typeof createRunRequestSchema>

export const createRunResponseSchema = z.object({
  runId: z.string().uuid(),
  conversationId: z.string().uuid(),
  eventStreamUrl: z.string(),
})
export type CreateRunResponse = z.infer<typeof createRunResponseSchema>

export const chatRunStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
])
export type ChatRunStatus = z.infer<typeof chatRunStatusSchema>

export const chatModelRunStatusSchema = z.enum([
  'queued',
  'running',
  'retrying',
  'completed',
  'failed',
  'cancelled',
])
export type ChatModelRunStatus = z.infer<typeof chatModelRunStatusSchema>
