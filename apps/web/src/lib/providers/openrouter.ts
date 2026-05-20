import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model } from '../types'
import { logger } from '../utils/logger'
import { estimateTokens, calculateCost } from '../utils/tokenizer'
import { openrouterVerifiedModels, getModelById } from '../models/verified-models'

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter' as const
  models = openrouterVerifiedModels as Model[]

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
        messages: request.messages.map(msg => {
          // Handle multimodal messages with attachments (OpenAI-compatible format)
          if (msg.attachments && msg.attachments.length > 0) {
            const content = []
            
            // Add text content if present
            if (msg.content) {
              content.push({
                type: "text",
                text: msg.content
              })
            }
            
            // Add image attachments
            msg.attachments.forEach(attachment => {
              if (attachment.type.startsWith('image/')) {
                const dataUrl = `data:${attachment.type};base64,${attachment.data}`
                logger.debug(`OpenRouter: Adding image attachment`, {
                  type: attachment.type,
                  dataLength: attachment.data?.length || 0,
                  dataUrlLength: dataUrl.length
                })
                content.push({
                  type: "image_url",
                  image_url: {
                    url: dataUrl
                  }
                })
              }
            })
            
            return {
              role: msg.role,
              content: content
            }
          }
          
          return {
            role: msg.role,
            content: msg.content
          }
        }),
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2048,
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
    // Check if model supports streaming
    const modelInfo = getModelById('openrouter', request.model)
    const supportsStreaming = modelInfo?.capabilities?.streaming !== false
    
    // For models that don't support streaming (mainly free models), use complete() instead
    if (!supportsStreaming) {
      logger.debug(`OpenRouter: Model ${request.model} doesn't support streaming, using complete() fallback`)
      try {
        const response = await this.complete(request, apiKey, signal)
        // Yield the complete response as a single chunk
        yield {
          id: response.id,
          content: response.content,
          done: false
        }
        yield {
          id: response.id,
          content: '',
          done: true,
          tokens: response.tokens?.total
        }
        return
      } catch (error) {
        logger.error('OpenRouter non-streaming model error:', error)
        throw error
      }
    }
    
    // Regular streaming for models that support it
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
        messages: request.messages.map(msg => {
          // Handle multimodal messages with attachments (same logic as complete method)
          if (msg.attachments && msg.attachments.length > 0) {
            const content = []
            
            if (msg.content) {
              content.push({
                type: "text",
                text: msg.content
              })
            }
            
            msg.attachments.forEach(attachment => {
              if (attachment.type.startsWith('image/')) {
                content.push({
                  type: "image_url",
                  image_url: {
                    url: `data:${attachment.type};base64,${attachment.data}`
                  }
                })
              }
            })
            
            return {
              role: msg.role,
              content: content
            }
          }
          
          return {
            role: msg.role,
            content: msg.content
          }
        }),
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2048,
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
          logger.debug('OpenRouter stream aborted')
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
            logger.debug('OpenRouter stream aborted during processing')
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
        logger.debug('OpenRouter stream aborted with error')
        return
      }
      throw error
    } finally {
      reader.releaseLock()
    }
  }
}