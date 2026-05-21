import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export interface OpenRouterAdapterInput {
  apiKey: string
  modelId: string
}

export function createOpenRouterModel({ apiKey, modelId }: OpenRouterAdapterInput): LanguageModel {
  const provider = createOpenAICompatible({
    name: 'openrouter',
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
  })
  return provider(modelId)
}
