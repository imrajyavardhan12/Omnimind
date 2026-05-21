import { ModelCatalogRepository, type ModelCatalogFilters } from '../repositories/model-catalog.repository.js'
import type { Db } from '../client.js'
import type { ModelCatalogEntry } from '../schema/index.js'

export type ModelCapability = 'streaming' | 'vision' | 'tools' | 'json' | 'files'

export interface ModelCapabilityRequirements {
  streaming?: boolean
  vision?: boolean
  tools?: boolean
  json?: boolean
  files?: boolean
}

export interface ValidateModelSelectionInput {
  provider: string
  modelId: string
  requiredCapabilities?: ModelCapabilityRequirements
  maxOutputTokens?: number
  enabledOnly?: boolean
}

export type ModelSelectionValidationResult =
  | { ok: true; model: ModelCatalogEntry }
  | { ok: false; code: 'MODEL_NOT_FOUND' | 'MODEL_DISABLED' | 'MODEL_DEPRECATED' | 'MODEL_CAPABILITY_UNSUPPORTED' | 'MAX_OUTPUT_TOKENS_EXCEEDED'; message: string }

export class ModelCatalogService {
  private readonly repository: ModelCatalogRepository

  constructor(db: Db) {
    this.repository = new ModelCatalogRepository(db)
  }

  listModels(filters: ModelCatalogFilters = {}) {
    return this.repository.findAll(filters)
  }

  findModel(provider: string, modelId: string) {
    return this.repository.findByProviderModel(provider, modelId)
  }

  async validateSelection(input: ValidateModelSelectionInput): Promise<ModelSelectionValidationResult> {
    const model = await this.repository.findByProviderModel(input.provider, input.modelId)

    if (!model) {
      return {
        ok: false,
        code: 'MODEL_NOT_FOUND',
        message: `Model ${input.provider}/${input.modelId} is not in the model catalog`,
      }
    }

    if (input.enabledOnly !== false && !model.isEnabled) {
      return {
        ok: false,
        code: 'MODEL_DISABLED',
        message: `Model ${input.provider}/${input.modelId} is disabled`,
      }
    }

    if (input.enabledOnly !== false && model.isDeprecated) {
      return {
        ok: false,
        code: 'MODEL_DEPRECATED',
        message: `Model ${input.provider}/${input.modelId} is deprecated`,
      }
    }

    const unsupportedCapability = findUnsupportedCapability(model, input.requiredCapabilities)
    if (unsupportedCapability) {
      return {
        ok: false,
        code: 'MODEL_CAPABILITY_UNSUPPORTED',
        message: `Model ${input.provider}/${input.modelId} does not support ${unsupportedCapability}`,
      }
    }

    if (input.maxOutputTokens !== undefined && input.maxOutputTokens > model.maxOutputTokens) {
      return {
        ok: false,
        code: 'MAX_OUTPUT_TOKENS_EXCEEDED',
        message: `Requested max output tokens (${input.maxOutputTokens}) exceeds ${model.maxOutputTokens} for ${input.provider}/${input.modelId}`,
      }
    }

    return { ok: true, model }
  }
}

function findUnsupportedCapability(
  model: ModelCatalogEntry,
  requirements: ModelCapabilityRequirements | undefined,
): ModelCapability | undefined {
  if (!requirements) return undefined

  if (requirements.streaming && !model.supportsStreaming) return 'streaming'
  if (requirements.vision && !model.supportsVision) return 'vision'
  if (requirements.tools && !model.supportsTools) return 'tools'
  if (requirements.json && !model.supportsJson) return 'json'
  if (requirements.files && !model.supportsFiles) return 'files'

  return undefined
}
