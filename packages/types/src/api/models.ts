import { z } from 'zod'
import { providerNameSchema } from './provider-keys.js'

export const modelCapabilitySchema = z.enum(['streaming', 'vision', 'tools', 'json', 'files'])
export type ModelCapability = z.infer<typeof modelCapabilitySchema>

export const listModelsQuerySchema = z.object({
  provider: providerNameSchema.optional(),
  capability: modelCapabilitySchema.optional(),
  enabledOnly: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
})
export type ListModelsQuery = z.infer<typeof listModelsQuerySchema>

export const modelCatalogEntrySchema = z.object({
  id: z.string().uuid(),
  provider: providerNameSchema,
  modelId: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  contextWindow: z.number().int(),
  maxOutputTokens: z.number().int(),
  // Returned as strings to preserve decimal precision for cost accounting
  inputCostPer1m: z.string(),
  outputCostPer1m: z.string(),
  supportsStreaming: z.boolean(),
  supportsVision: z.boolean(),
  supportsTools: z.boolean(),
  supportsJson: z.boolean(),
  supportsFiles: z.boolean(),
  speedTier: z.string().nullable(),
  qualityTier: z.string().nullable(),
  isEnabled: z.boolean(),
  isDeprecated: z.boolean(),
  metadataJson: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type ModelCatalogEntryResponse = z.infer<typeof modelCatalogEntrySchema>
