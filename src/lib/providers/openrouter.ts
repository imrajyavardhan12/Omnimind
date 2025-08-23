import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model } from '../types'
import { estimateTokens, calculateCost } from '../utils/tokenizer'

// Minimal fallback models when API is not available
export const openrouterModels: Model[] = [
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B (FREE)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'google/gemma-2-9b-it:free',
    name: 'Gemma 2 9B (FREE)',
    provider: 'openrouter',
    contextLength: 8192,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.00015,
    outputCost: 0.0006
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'openrouter',
    contextLength: 200000,
    inputCost: 0.00025,
    outputCost: 0.00125
  }
]

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter' as const
  models = openrouterModels

  async validateAPIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      return response.ok
    } catch (error) {
      console.error('OpenRouter API key validation failed:', error)
      return false
    }
  }

  async complete(request: ChatRequest, apiKey: string, signal?: AbortSignal): Promise<ChatResponse> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://omnimind.ai',
        'X-Title': 'OmniMind',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`)
    }

    const data = await response.json()
    const choice = data.choices[0]
    const inputTokens = data.usage?.prompt_tokens || 0
    const outputTokens = data.usage?.completion_tokens || 0
    const totalTokens = data.usage?.total_tokens || (inputTokens + outputTokens)
    
    return {
      id: data.id,
      content: choice.message.content,
      model: request.model,
      provider: 'openrouter',
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens
      },
      cost: calculateCost(inputTokens, outputTokens, request.model),
      finishReason: choice.finish_reason
    }
  }

  async* stream(request: ChatRequest, apiKey: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://omnimind.ai',
        'X-Title': 'OmniMind',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`)
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
          console.log('OpenRouter stream aborted')
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
            console.log('OpenRouter stream aborted during processing')
            reader.releaseLock()
            return
          }

          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              yield {
                id: crypto.randomUUID(),
                content: '',
                done: true
              }
              return
            }

            try {
              const parsed = JSON.parse(data)
              const choice = parsed.choices[0]
              if (choice?.delta?.content) {
                yield {
                  id: parsed.id,
                  content: choice.delta.content,
                  done: false
                }
              }
            } catch (error) {
              console.error('Failed to parse SSE data:', error)
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('OpenRouter stream aborted with error')
        return
      }
      throw error
    } finally {
      reader.releaseLock()
    }
  }
}