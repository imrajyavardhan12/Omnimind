import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelSelectionValidationResult, ValidateModelSelectionInput } from '@omnimind/db'
import type { GatewayStreamChunk } from '@omnimind/types'

// Mock `ai` at the test seam. The gateway only uses `streamText` from `ai`
// (plus the `ModelMessage` / `LanguageModelUsage` types, which are erased at
// runtime), so this is sufficient.
const streamTextMock = vi.fn()
vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => streamTextMock(...args),
}))

// Pull the gateway AFTER vi.mock is hoisted.
const { LLMGateway } = await import('../llm-gateway.js')

interface FakeModel {
  isEnabled: boolean
  isDeprecated: boolean
  maxOutputTokens: number
  supportsStreaming: boolean
  supportsVision: boolean
  supportsTools: boolean
  supportsJson: boolean
  supportsFiles: boolean
}

function makeService(handler: (input: ValidateModelSelectionInput) => ModelSelectionValidationResult) {
  return {
    validateSelection: vi.fn(async (input: ValidateModelSelectionInput) => handler(input)),
    listModels: vi.fn(),
    findModel: vi.fn(),
  } as unknown as import('@omnimind/db').ModelCatalogService
}

function streamingModel(overrides: Partial<FakeModel> = {}): FakeModel {
  return {
    isEnabled: true,
    isDeprecated: false,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: false,
    supportsJson: false,
    supportsFiles: false,
    ...overrides,
  }
}

async function asyncIterable<T>(items: T[]): Promise<AsyncIterable<T>> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const it of items) yield it
    },
  }
}

async function collect(stream: AsyncIterable<GatewayStreamChunk>): Promise<GatewayStreamChunk[]> {
  const out: GatewayStreamChunk[] = []
  for await (const chunk of stream) out.push(chunk)
  return out
}

beforeEach(() => {
  streamTextMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LLMGateway.stream — model validation', () => {
  it('yields a typed MODEL_NOT_FOUND error chunk when validateSelection fails (no provider call)', async () => {
    const service = makeService(() => ({
      ok: false,
      code: 'MODEL_NOT_FOUND',
      message: 'unknown',
    }))
    const gateway = new LLMGateway({ modelCatalogService: service })

    const chunks = await collect(gateway.stream({
      provider: 'openai',
      model: 'definitely-not-a-real-model',
      messages: [{ role: 'user', content: 'hi' }],
      providerKey: 'sk-fake',
    }))

    expect(chunks).toEqual([
      { type: 'error', error: { code: 'MODEL_NOT_FOUND', message: 'unknown' } },
    ])
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('rejects a non-streaming reasoning model (o1) with MODEL_CAPABILITY_UNSUPPORTED', async () => {
    const service = makeService((input) => {
      // Mirror what ModelCatalogService.validateSelection does for o1.
      if (input.requiredCapabilities?.streaming) {
        return {
          ok: false,
          code: 'MODEL_CAPABILITY_UNSUPPORTED',
          message: `Model ${input.provider}/${input.modelId} does not support streaming`,
        }
      }
      return { ok: true, model: streamingModel({ supportsStreaming: false }) as never }
    })
    const gateway = new LLMGateway({ modelCatalogService: service })

    const chunks = await collect(gateway.stream({
      provider: 'openai',
      model: 'o1',
      messages: [{ role: 'user', content: 'hi' }],
      providerKey: 'sk-fake',
    }))

    expect(chunks[0]).toMatchObject({ type: 'error', error: { code: 'MODEL_CAPABILITY_UNSUPPORTED' } })
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it.each([
    'MODEL_DISABLED',
    'MODEL_DEPRECATED',
    'MAX_OUTPUT_TOKENS_EXCEEDED',
  ] as const)('forwards %s from validateSelection as a typed error chunk', async (code) => {
    const service = makeService(() => ({ ok: false, code, message: `failure: ${code}` }))
    const gateway = new LLMGateway({ modelCatalogService: service })

    const chunks = await collect(gateway.stream({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      providerKey: 'sk-fake',
    }))

    expect(chunks).toEqual([
      { type: 'error', error: { code, message: `failure: ${code}` } },
    ])
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('asks the catalog with requiredCapabilities.streaming = true', async () => {
    let captured: ValidateModelSelectionInput | undefined
    const service = makeService((input) => {
      captured = input
      return { ok: false, code: 'MODEL_NOT_FOUND', message: 'x' }
    })
    const gateway = new LLMGateway({ modelCatalogService: service })

    await collect(gateway.stream({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      providerKey: 'sk-fake',
    }))

    expect(captured?.requiredCapabilities).toEqual({ streaming: true })
  })
})

describe('LLMGateway.stream — normalization', () => {
  // Each provider routes through getAdapter → adapter() → streamText, and the
  // M4 prompt asks for per-adapter assertion that mocked provider output is
  // normalized into the GatewayStreamChunk contract. With streamText mocked at
  // the seam, parameterizing over providers covers all five adapter paths
  // without duplicating fixtures.
  const providers: import('../types.js').ProviderName[] = [
    'openai',
    'anthropic',
    'gemini',
    'google-ai-studio',
    'openrouter',
  ]

  const modelByProvider: Record<typeof providers[number], string> = {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    gemini: 'gemini-1.5-pro',
    'google-ai-studio': 'gemini-1.5-pro',
    openrouter: 'openai/gpt-4o',
  }

  it.each(providers)(
    'emits delta chunks for text-delta parts and a done chunk with normalized usage on finish (%s)',
    async (provider) => {
      const service = makeService(() => ({ ok: true, model: streamingModel() as never }))
      const gateway = new LLMGateway({ modelCatalogService: service })

      streamTextMock.mockReturnValue({
        fullStream: await asyncIterable([
          { type: 'start' },
          { type: 'text-start', id: 'a' },
          { type: 'text-delta', id: 'a', text: 'Hello' },
          { type: 'text-delta', id: 'a', text: ', world' },
          { type: 'text-end', id: 'a' },
          {
            type: 'finish',
            finishReason: 'stop',
            rawFinishReason: 'stop',
            totalUsage: {
              inputTokens: 12,
              outputTokens: 34,
              totalTokens: 46,
              inputTokenDetails: { noCacheTokens: 12, cacheReadTokens: undefined, cacheWriteTokens: undefined },
              outputTokenDetails: { textTokens: 34, reasoningTokens: undefined },
            },
          },
        ]),
      })

      const chunks = await collect(gateway.stream({
        provider,
        model: modelByProvider[provider],
        messages: [{ role: 'user', content: 'hi' }],
        providerKey: 'sk-fake',
      }))

      expect(chunks).toEqual([
        { type: 'delta', delta: 'Hello' },
        { type: 'delta', delta: ', world' },
        {
          type: 'done',
          finishReason: 'stop',
          usage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 },
        },
      ])
      // The mocked streamText must have received a model object for this provider.
      expect(streamTextMock).toHaveBeenCalledTimes(1)
      const [opts] = streamTextMock.mock.calls[0] as [{ model: unknown }]
      expect(typeof opts.model).toBe('object')
    },
  )

  it('classifies a missing-key LoadAPIKeyError as PROVIDER_AUTH_FAILED, not UNKNOWN', async () => {
    const service = makeService(() => ({ ok: true, model: streamingModel() as never }))
    const gateway = new LLMGateway({ modelCatalogService: service })

    // Shape mirrors what @ai-sdk/provider-utils throws when apiKey is empty.
    const loadKeyError = Object.assign(new Error("OpenAI API key is missing. Pass it using the 'apiKey' parameter."), {
      name: 'AI_LoadAPIKeyError',
    })

    streamTextMock.mockReturnValue({
      fullStream: await asyncIterable([{ type: 'error', error: loadKeyError }]),
    })

    const chunks = await collect(gateway.stream({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      providerKey: '',
    }))

    expect(chunks).toEqual([
      {
        type: 'error',
        error: {
          code: 'PROVIDER_AUTH_FAILED',
          message: "OpenAI API key is missing. Pass it using the 'apiKey' parameter.",
          retryable: false,
        },
      },
    ])
  })

  it('never forwards tools to streamText (text-only contract at M4A)', async () => {
    const service = makeService(() => ({ ok: true, model: streamingModel() as never }))
    const gateway = new LLMGateway({ modelCatalogService: service })

    streamTextMock.mockReturnValue({
      fullStream: await asyncIterable([
        {
          type: 'finish',
          finishReason: 'stop',
          rawFinishReason: 'stop',
          totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    })

    await collect(gateway.stream({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      providerKey: 'sk-fake',
    }))

    // Pins the contract: extending GatewayStreamChunk to surface tool-* parts
    // is a deliberate M5+ change. Silently passing tools through here would
    // make `tool-error` parts disappear into the default: branch of the
    // gateway's switch, masking real provider failures.
    const [opts] = streamTextMock.mock.calls[0] as [Record<string, unknown>]
    expect(opts['tools']).toBeUndefined()
  })

  it('maps an error stream part into a typed error chunk and stops the stream', async () => {
    const service = makeService(() => ({ ok: true, model: streamingModel() as never }))
    const gateway = new LLMGateway({ modelCatalogService: service })

    streamTextMock.mockReturnValue({
      fullStream: await asyncIterable([
        { type: 'text-delta', id: 'a', text: 'partial' },
        { type: 'error', error: Object.assign(new Error('rate limited'), { status: 429 }) },
        // Anything after should be unreachable.
        {
          type: 'finish',
          finishReason: 'stop',
          rawFinishReason: 'stop',
          totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    })

    const chunks = await collect(gateway.stream({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      providerKey: 'sk-fake',
    }))

    expect(chunks.map((c) => c.type)).toEqual(['delta', 'error'])
    expect(chunks[1]).toMatchObject({
      type: 'error',
      error: { code: 'PROVIDER_RATE_LIMITED', retryable: true },
    })
  })
})

describe('LLMGateway.stream — cancellation', () => {
  it('threads AbortSignal to streamText and surfaces CANCELLED when aborted mid-stream', async () => {
    const service = makeService(() => ({ ok: true, model: streamingModel() as never }))
    const gateway = new LLMGateway({ modelCatalogService: service })

    const controller = new AbortController()
    let receivedSignal: AbortSignal | undefined
    streamTextMock.mockImplementation((opts: { abortSignal?: AbortSignal }) => {
      receivedSignal = opts.abortSignal
      return {
        fullStream: {
          async *[Symbol.asyncIterator]() {
            yield { type: 'text-delta', id: 'a', text: 'part 1' }
            controller.abort()
            // Simulate the AI SDK surfacing the abort as a stream part.
            yield { type: 'abort', reason: 'client cancelled' }
          },
        },
      }
    })

    const chunks = await collect(gateway.stream({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      providerKey: 'sk-fake',
      abortSignal: controller.signal,
    }))

    expect(receivedSignal).toBe(controller.signal)
    expect(chunks).toEqual([
      { type: 'delta', delta: 'part 1' },
      { type: 'error', error: { code: 'CANCELLED', message: 'client cancelled' } },
    ])
  })

  it('surfaces CANCELLED when fullStream throws and the signal is aborted', async () => {
    const service = makeService(() => ({ ok: true, model: streamingModel() as never }))
    const gateway = new LLMGateway({ modelCatalogService: service })

    const controller = new AbortController()
    streamTextMock.mockReturnValue({
      fullStream: {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text-delta', id: 'a', text: 'oops' }
          controller.abort()
          throw Object.assign(new Error('aborted'), { name: 'AbortError' })
        },
      },
    })

    const chunks = await collect(gateway.stream({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      providerKey: 'sk-fake',
      abortSignal: controller.signal,
    }))

    expect(chunks).toEqual([
      { type: 'delta', delta: 'oops' },
      { type: 'error', error: { code: 'CANCELLED', message: 'Stream aborted by caller' } },
    ])
  })
})
