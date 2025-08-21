import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model } from '../types'
import { estimateTokens, calculateCost } from '../utils/tokenizer'

export const openrouterModels: Model[] = [
  // OpenAI models via OpenRouter
  {
    id: 'openai/gpt-4',
    name: 'GPT-4 (OpenRouter)',
    provider: 'openrouter',
    contextLength: 8192,
    inputCost: 0.03,
    outputCost: 0.06
  },
  {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo (OpenRouter)',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.01,
    outputCost: 0.03
  },
  {
    id: 'openai/gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo (OpenRouter)',
    provider: 'openrouter',
    contextLength: 16385,
    inputCost: 0.001,
    outputCost: 0.002
  },
  // Anthropic models via OpenRouter
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet (OpenRouter)',
    provider: 'openrouter',
    contextLength: 200000,
    inputCost: 0.003,
    outputCost: 0.015
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus (OpenRouter)',
    provider: 'openrouter',
    contextLength: 200000,
    inputCost: 0.015,
    outputCost: 0.075
  },
  // Meta models
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0.0009,
    outputCost: 0.0009
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0.0001,
    outputCost: 0.0001
  },
  // Mistral models
  {
    id: 'mistralai/mistral-large',
    name: 'Mistral Large',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.008,
    outputCost: 0.024
  },
  {
    id: 'mistralai/mistral-medium',
    name: 'Mistral Medium',
    provider: 'openrouter',
    contextLength: 32000,
    inputCost: 0.0027,
    outputCost: 0.0081
  },
  // Google models
  {
    id: 'google/gemini-pro',
    name: 'Gemini Pro (OpenRouter)',
    provider: 'openrouter',
    contextLength: 91728,
    inputCost: 0.000125,
    outputCost: 0.000375
  },
  // Additional popular models via OpenRouter
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku (OpenRouter)',
    provider: 'openrouter',
    contextLength: 200000,
    inputCost: 0.00025,
    outputCost: 0.00125
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (OpenRouter)',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.005,
    outputCost: 0.015
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (OpenRouter)',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.00015,
    outputCost: 0.0006
  },
  {
    id: 'perplexity/llama-3.1-sonar-large-128k-online',
    name: 'Llama 3.1 Sonar Large (Online)',
    provider: 'openrouter',
    contextLength: 127072,
    inputCost: 0.001,
    outputCost: 0.001
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini 1.5 Flash (OpenRouter)',
    provider: 'openrouter',
    contextLength: 1000000,
    inputCost: 0.000075,
    outputCost: 0.0003
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

  async complete(request: ChatRequest, apiKey: string): Promise<ChatResponse> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
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

  async* stream(request: ChatRequest, apiKey: string): AsyncGenerator<StreamChunk> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
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
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
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
    } finally {
      reader.releaseLock()
    }
  }
}