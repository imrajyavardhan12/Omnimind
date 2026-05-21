import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'

export interface AnthropicAdapterInput {
  apiKey: string
  modelId: string
}

export function createAnthropicModel({ apiKey, modelId }: AnthropicAdapterInput): LanguageModel {
  const provider = createAnthropic({ apiKey })
  return provider(modelId)
}
