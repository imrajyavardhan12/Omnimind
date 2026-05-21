import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export interface OpenAIAdapterInput {
  apiKey: string
  modelId: string
}

export function createOpenAIModel({ apiKey, modelId }: OpenAIAdapterInput): LanguageModel {
  const provider = createOpenAI({ apiKey })
  return provider(modelId)
}
