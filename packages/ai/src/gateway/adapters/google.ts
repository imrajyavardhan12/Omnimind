import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

export interface GoogleAdapterInput {
  apiKey: string
  modelId: string
}

/**
 * Single Google Generative AI adapter shared by both `gemini` (BYOK) and
 * `google-ai-studio` (hosted) providers. The only difference between the two
 * provider rows in the model catalog is where the API key comes from; the
 * underlying SDK call is identical.
 */
export function createGoogleModel({ apiKey, modelId }: GoogleAdapterInput): LanguageModel {
  const provider = createGoogleGenerativeAI({ apiKey })
  return provider(modelId)
}
