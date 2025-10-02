import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model } from '../types'
import { logger } from '../utils/logger'
import { estimateTokens, calculateCost } from '../utils/tokenizer'
import { geminiVerifiedModels } from '../models/verified-models'

export class GeminiProvider implements LLMProvider {
  name = 'gemini' as const
  models = geminiVerifiedModels as Model[]

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
        logger.debug('Gemini stream aborted')
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
        const parts = []
        
        // Add text content if present
        if (message.content) {
          parts.push({ text: message.content })
        }
        
        // Handle multimodal messages with attachments
        if (message.attachments && message.attachments.length > 0) {
          message.attachments.forEach((attachment: any) => {
            if (attachment.type.startsWith('image/')) {
              parts.push({
                inline_data: {
                  mime_type: attachment.type,
                  data: attachment.data
                }
              })
            }
          })
        }
        
        contents.push({
          role: 'user',
          parts: parts
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