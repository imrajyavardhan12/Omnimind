import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model } from '../types'
import { estimateTokens, calculateCost } from '../utils/tokenizer'

// Fallback models when API is not available - updated with latest models
export const geminiModels: Model[] = [
  {
    id: 'gemini-1.5-pro-latest',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    contextLength: 2097152, // 2M tokens
    inputCost: 0.00125,
    outputCost: 0.005
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    contextLength: 1048576, // 1M tokens
    inputCost: 0.000075,
    outputCost: 0.0003
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash 8B',
    provider: 'gemini',
    contextLength: 1048576,
    inputCost: 0.0000375,
    outputCost: 0.00015
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'gemini',
    contextLength: 32768,
    inputCost: 0.0005,
    outputCost: 0.0015
  }
]

export class GeminiProvider implements LLMProvider {
  name = 'gemini' as const
  models = geminiModels

  async validateAPIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      return response.ok
    } catch (error) {
      console.error('Gemini API key validation failed:', error)
      return false
    }
  }

  async complete(request: ChatRequest, apiKey: string, signal?: AbortSignal): Promise<ChatResponse> {
    // Convert messages to Gemini format
    const contents = this.convertMessagesToGeminiFormat(request.messages)
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 1000,
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.candidates || data.candidates.length === 0) {
      console.error('No candidates in Gemini response:', data)
      throw new Error('No response from Gemini API')
    }

    const candidate = data.candidates[0]
    const textPart = candidate.content?.parts?.find((part: any) => part.text)
    const content = textPart?.text || ''
    
    if (!content) {
      console.warn('No text content found in Gemini response')
    }
    
    // Estimate tokens since Gemini doesn't always provide usage info
    const inputTokens = estimateTokens(request.messages.map(m => m.content).join(' '))
    const outputTokens = estimateTokens(content)
    
    return {
      id: crypto.randomUUID(),
      content,
      model: request.model,
      provider: 'gemini',
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      },
      cost: calculateCost(inputTokens, outputTokens, request.model),
      finishReason: candidate.finishReason || 'stop'
    }
  }

  async* stream(request: ChatRequest, apiKey: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    // For now, use the complete endpoint and simulate streaming
    // since Gemini's streaming endpoint returns the complete response at once
    try {
      const response = await this.complete(request, apiKey, signal)
      
      // Simulate streaming by yielding the complete content
      if (response.content) {
        yield {
          id: response.id,
          content: response.content,
          done: false,
          tokens: response.tokens?.total
        }
      }
      
      // Signal completion
      yield {
        id: response.id,
        content: '',
        done: true,
        tokens: response.tokens?.total
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Gemini stream aborted')
        return
      }
      throw error
    }
  }

  private convertMessagesToGeminiFormat(messages: any[]) {
    const contents = []
    
    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini doesn't have a system role, so we'll add it as the first user message
        contents.push({
          role: 'user',
          parts: [{ text: `System: ${message.content}` }]
        })
      } else if (message.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: message.content }]
        })
      } else if (message.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: message.content }]
        })
      }
    }
    
    return contents
  }
}