import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model } from '../types'
import { logger } from '../utils/logger'
import { estimateTokens, calculateCost } from '../utils/tokenizer'

// Fallback models when API is not available - updated with latest models
export const anthropicModels: Model[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (Latest)',
    provider: 'anthropic',
    contextLength: 200000,
    inputCost: 0.003,
    outputCost: 0.015
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextLength: 200000,
    inputCost: 0.001,
    outputCost: 0.005
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextLength: 200000,
    inputCost: 0.015,
    outputCost: 0.075
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    contextLength: 200000,
    inputCost: 0.003,
    outputCost: 0.015
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    contextLength: 200000,
    inputCost: 0.00025,
    outputCost: 0.00125
  }
]

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic' as const
  models = anthropicModels

  async validateAPIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        })
      })
      return response.ok || response.status === 400 // 400 is expected for validation
    } catch (error) {
      console.error('Anthropic API key validation failed:', error)
      return false
    }
  }

  async complete(request: ChatRequest, apiKey: string, signal?: AbortSignal): Promise<ChatResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        messages: request.messages
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
            role: msg.role,
            content: msg.content
          })),
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`)
    }

    const data = await response.json()
    const inputTokens = data.usage?.input_tokens || 0
    const outputTokens = data.usage?.output_tokens || 0
    const totalTokens = inputTokens + outputTokens
    
    return {
      id: data.id,
      content: data.content[0]?.text || '',
      model: request.model,
      provider: 'anthropic',
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens
      },
      cost: calculateCost(inputTokens, outputTokens, request.model),
      finishReason: data.stop_reason
    }
  }

  async* stream(request: ChatRequest, apiKey: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        messages: request.messages
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
            role: msg.role,
            content: msg.content
          })),
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        // Check if aborted before reading
        if (signal?.aborted) {
          logger.debug('Anthropic stream aborted')
          reader.releaseLock()
          break
        }

        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          // Check abort signal in the loop
          if (signal?.aborted) {
            logger.debug('Anthropic stream aborted during processing')
            reader.releaseLock()
            return
          }

          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            try {
              const parsed = JSON.parse(data)
              
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield {
                  id: crypto.randomUUID(),
                  content: parsed.delta.text,
                  done: false
                }
              } else if (parsed.type === 'message_stop') {
                yield {
                  id: crypto.randomUUID(),
                  content: '',
                  done: true
                }
                return
              }
            } catch (error) {
              console.error('Failed to parse SSE data:', error)
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('Anthropic stream aborted with error')
        return
      }
      throw error
    } finally {
      reader.releaseLock()
    }
  }
}
