import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model } from '../types'
import { estimateTokens, calculateCost } from '../utils/tokenizer'

export const openrouterModels: Model[] = [
  // === FREE MODELS ===
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B (Free)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'Qwen 2.5 Coder 32B (Free)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'qwen/qwen-2.5-coder-7b-instruct:free',
    name: 'Qwen 2.5 Coder 7B (Free)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'qwen/qwen3-coder:free',
    name: 'Qwen 3 Coder (Free)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B (Free)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B (Free)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'microsoft/phi-3-medium-128k-instruct:free',
    name: 'Phi-3 Medium 128K (Free)',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'google/gemma-2-9b-it:free',
    name: 'Gemma 2 9B (Free)',
    provider: 'openrouter',
    contextLength: 8192,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'huggingface/zephyr-7b-beta:free',
    name: 'Zephyr 7B Beta (Free)',
    provider: 'openrouter',
    contextLength: 32768,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'openchat/openchat-7b:free',
    name: 'OpenChat 7B (Free)',
    provider: 'openrouter',
    contextLength: 8192,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'gryphe/mythomist-7b:free',
    name: 'MythoMist 7B (Free)',
    provider: 'openrouter',
    contextLength: 32768,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-405b:free',
    name: 'Hermes 3 Llama 405B (Free)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'liquid/lfm-40b:free',
    name: 'Liquid LFM 40B (Free)',
    provider: 'openrouter',
    contextLength: 32768,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'cognitivecomputations/dolphin-llama-3-70b:free',
    name: 'Dolphin Llama 3 70B (Free)',
    provider: 'openrouter',
    contextLength: 8192,
    inputCost: 0,
    outputCost: 0
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT-OSS 20B (Free)',
    provider: 'openrouter',
    contextLength: 32768,
    inputCost: 0,
    outputCost: 0
  },

  // === LATEST MODELS (2025) ===
  {
    id: 'deepseek/deepseek-chat-v3.1',
    name: 'DeepSeek Chat V3.1 (Ultra Cheap)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0.00000027,
    outputCost: 0.0000011
  },
  {
    id: 'deepseek/deepseek-chat-v3.1:thinking',
    name: 'DeepSeek Chat V3.1 Reasoning',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0.00000055,
    outputCost: 0.00000219
  },

  // === CUTTING-EDGE OPENAI MODELS ===
  {
    id: 'openai/gpt-5',
    name: 'GPT-5',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.00000125,
    outputCost: 0.00001
  },
  {
    id: 'openai/gpt-5-chat',
    name: 'GPT-5 Chat',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.00000125,
    outputCost: 0.00001
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.00000025,
    outputCost: 0.000002
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.00000005,
    outputCost: 0.0000004
  },
  {
    id: 'openai/o3-pro',
    name: 'GPT-o3 Pro',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.00002,
    outputCost: 0.00008
  },
  {
    id: 'openai/o3',
    name: 'GPT-o3',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.000002,
    outputCost: 0.000008
  },
  {
    id: 'openai/o3-mini',
    name: 'GPT-o3 Mini',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.0000011,
    outputCost: 0.0000044
  },

  // === GPT-OSS (OPEN SOURCE) MODELS ===
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B (Ultra Cheap)',
    provider: 'openrouter',
    contextLength: 32768,
    inputCost: 0.00000004,
    outputCost: 0.00000015
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'openrouter',
    contextLength: 32768,
    inputCost: 0.000000072,
    outputCost: 0.00000028
  },

  // === SPECIALIZED OPENAI MODELS ===
  {
    id: 'openai/gpt-4o-audio-preview',
    name: 'GPT-4o Audio Preview',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.0000025,
    outputCost: 0.00001
  },

  // === CLASSIC OPENAI MODELS ===
  {
    id: 'openai/o1-preview',
    name: 'GPT-o1 Preview',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.015,
    outputCost: 0.06
  },
  {
    id: 'openai/o1-mini',
    name: 'GPT-o1 Mini',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.003,
    outputCost: 0.012
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.005,
    outputCost: 0.015
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
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.01,
    outputCost: 0.03
  },
  {
    id: 'openai/gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openrouter',
    contextLength: 16385,
    inputCost: 0.001,
    outputCost: 0.002
  },

  // === ANTHROPIC MODELS ===
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    contextLength: 200000,
    inputCost: 0.003,
    outputCost: 0.015
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'openrouter',
    contextLength: 200000,
    inputCost: 0.015,
    outputCost: 0.075
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'openrouter',
    contextLength: 200000,
    inputCost: 0.00025,
    outputCost: 0.00125
  },

  // === GOOGLE MODELS ===
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini 1.5 Pro',
    provider: 'openrouter',
    contextLength: 2097152,
    inputCost: 0.00125,
    outputCost: 0.005
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini 1.5 Flash',
    provider: 'openrouter',
    contextLength: 1000000,
    inputCost: 0.000075,
    outputCost: 0.0003
  },

  // === META LLAMA MODELS ===
  {
    id: 'meta-llama/llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0.005,
    outputCost: 0.005
  },
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
    name: 'Llama 3.1 8B (Paid)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0.00018,
    outputCost: 0.00018
  },

  // === MISTRAL MODELS ===
  {
    id: 'mistralai/mistral-large',
    name: 'Mistral Large',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.008,
    outputCost: 0.024
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct',
    name: 'Mixtral 8x7B',
    provider: 'openrouter',
    contextLength: 32768,
    inputCost: 0.00024,
    outputCost: 0.00024
  },

  // === CODING MODELS ===
  {
    id: 'deepseek/deepseek-coder-v2',
    name: 'DeepSeek Coder V2',
    provider: 'openrouter',
    contextLength: 163840,
    inputCost: 0.00014,
    outputCost: 0.00028
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B (Paid)',
    provider: 'openrouter',
    contextLength: 131072,
    inputCost: 0.00018,
    outputCost: 0.00018
  },

  // === PERPLEXITY ONLINE MODELS ===
  {
    id: 'perplexity/llama-3.1-sonar-large-128k-online',
    name: 'Llama 3.1 Sonar Large (Online)',
    provider: 'openrouter',
    contextLength: 127072,
    inputCost: 0.001,
    outputCost: 0.001
  },
  {
    id: 'perplexity/llama-3.1-sonar-small-128k-online',
    name: 'Llama 3.1 Sonar Small (Online)',
    provider: 'openrouter',
    contextLength: 127072,
    inputCost: 0.0002,
    outputCost: 0.0002
  },

  // === COHERE MODELS ===
  {
    id: 'cohere/command-r-plus',
    name: 'Command R+',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.003,
    outputCost: 0.015
  },
  {
    id: 'cohere/command-r',
    name: 'Command R',
    provider: 'openrouter',
    contextLength: 128000,
    inputCost: 0.0005,
    outputCost: 0.0015
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