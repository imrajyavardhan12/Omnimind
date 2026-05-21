import { describe, expect, it } from 'vitest'
import { getAdapter } from '../adapter-registry.js'
import type { ProviderName } from '../types.js'

describe('adapter registry', () => {
  const providers: ProviderName[] = ['openai', 'anthropic', 'gemini', 'google-ai-studio', 'openrouter']

  for (const provider of providers) {
    it(`returns an adapter that produces a model for ${provider}`, () => {
      const adapter = getAdapter(provider)
      expect(typeof adapter).toBe('function')

      const model = adapter({ apiKey: 'test-key-not-real', modelId: 'test-model' })
      // LanguageModelV3 contract: at minimum the SDK puts a non-empty modelId on the instance.
      expect(typeof model).toBe('object')
      expect(typeof (model as { modelId: string }).modelId).toBe('string')
      expect((model as { modelId: string }).modelId).toBe('test-model')
    })
  }

  it('shares the same google adapter for gemini and google-ai-studio', () => {
    expect(getAdapter('gemini')).toBe(getAdapter('google-ai-studio'))
  })
})
