import type { LanguageModel } from 'ai'
import type { ProviderName } from './types.js'
import { createOpenAIModel } from './adapters/openai.js'
import { createAnthropicModel } from './adapters/anthropic.js'
import { createGoogleModel } from './adapters/google.js'
import { createOpenRouterModel } from './adapters/openrouter.js'

export interface AdapterInput {
  apiKey: string
  modelId: string
}

export type ProviderAdapter = (input: AdapterInput) => LanguageModel

const ADAPTERS: Record<ProviderName, ProviderAdapter> = {
  openai: createOpenAIModel,
  anthropic: createAnthropicModel,
  // gemini (BYOK) and google-ai-studio (hosted) share the same SDK call;
  // the only difference is where the apiKey originated.
  gemini: createGoogleModel,
  'google-ai-studio': createGoogleModel,
  openrouter: createOpenRouterModel,
}

export function getAdapter(provider: ProviderName): ProviderAdapter {
  return ADAPTERS[provider]
}
