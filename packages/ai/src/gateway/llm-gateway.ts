import { streamText, type ModelMessage } from 'ai'
import type { ModelCatalogService, ModelSelectionValidationResult } from '@omnimind/db'
import type { GatewayMessage, GatewayStreamChunk } from '@omnimind/types'
import type { LLMGatewayRequest } from './types.js'
import { getAdapter } from './adapter-registry.js'
import { gatewayError, mapAiSdkError } from './errors.js'
import { normalizeUsage } from './usage.js'

export interface LLMGatewayDeps {
  modelCatalogService: ModelCatalogService
}

export class LLMGateway {
  private readonly modelCatalogService: ModelCatalogService

  constructor(deps: LLMGatewayDeps) {
    this.modelCatalogService = deps.modelCatalogService
  }

  async *stream(request: LLMGatewayRequest): AsyncGenerator<GatewayStreamChunk, void, void> {
    const validation = await this.modelCatalogService.validateSelection({
      provider: request.provider,
      modelId: request.model,
      requiredCapabilities: { streaming: true },
      maxOutputTokens: request.maxOutputTokens,
    })

    if (!validation.ok) {
      yield { type: 'error', error: mapValidationFailure(validation) }
      return
    }

    const adapter = getAdapter(request.provider)
    if (!adapter) {
      yield {
        type: 'error',
        error: gatewayError('MODEL_NOT_FOUND', `No adapter registered for provider ${request.provider}`),
      }
      return
    }

    const model = adapter({ apiKey: request.providerKey, modelId: request.model })

    let result: ReturnType<typeof streamText>
    try {
      const callOpts: Parameters<typeof streamText>[0] = {
        model,
        messages: toModelMessages(request.messages),
      }
      if (request.system !== undefined) callOpts.system = request.system
      if (request.temperature !== undefined) callOpts.temperature = request.temperature
      if (request.maxOutputTokens !== undefined) callOpts.maxOutputTokens = request.maxOutputTokens
      if (request.abortSignal !== undefined) callOpts.abortSignal = request.abortSignal
      result = streamText(callOpts)
    } catch (err) {
      yield { type: 'error', error: mapAiSdkError(err) }
      return
    }

    try {
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            if (part.text.length > 0) yield { type: 'delta', delta: part.text }
            break
          case 'finish': {
            const chunk: GatewayStreamChunk = { type: 'done' }
            if (part.finishReason) chunk.finishReason = part.finishReason
            const usage = normalizeUsage(part.totalUsage)
            if (usage) chunk.usage = usage
            yield chunk
            return
          }
          case 'abort':
            yield {
              type: 'error',
              error: gatewayError('CANCELLED', part.reason ?? 'Stream aborted'),
            }
            return
          case 'error':
            yield { type: 'error', error: mapAiSdkError(part.error) }
            return
          default:
            // text-start/-end, reasoning-*, tool-*, source, file, start-step,
            // finish-step, start, raw — not surfaced through the M4A delta/done/error
            // protocol. Future milestones may extend GatewayStreamChunk.
            break
        }
      }
    } catch (err) {
      if (request.abortSignal?.aborted) {
        yield { type: 'error', error: gatewayError('CANCELLED', 'Stream aborted by caller') }
        return
      }
      yield { type: 'error', error: mapAiSdkError(err) }
    }
  }
}

function mapValidationFailure(result: Extract<ModelSelectionValidationResult, { ok: false }>) {
  return gatewayError(result.code, result.message)
}

function toModelMessages(messages: GatewayMessage[]): ModelMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content })) as ModelMessage[]
}
