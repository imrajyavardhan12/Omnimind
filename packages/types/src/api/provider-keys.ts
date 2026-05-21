import { z } from 'zod'

export const providerNameSchema = z.enum(['openai', 'anthropic', 'gemini', 'openrouter', 'google-ai-studio'])
export type ProviderName = z.infer<typeof providerNameSchema>

export const upsertProviderKeySchema = z.object({
  key: z.string().min(1).max(512),
})

export type UpsertProviderKeyInput = z.infer<typeof upsertProviderKeySchema>
