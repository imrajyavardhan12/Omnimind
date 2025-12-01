import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model, RetryStatus } from '../types'
import { logger } from '../utils/logger'
import { estimateTokens, calculateCost } from '../utils/tokenizer'
import { googleAIStudioVerifiedModels } from '../models/verified-models'
import { 
  withRetry, 
  RetryState, 
  RetryableError, 
  isRetryableStatusCode,
  DEFAULT_RETRY_OPTIONS 
} from '../utils/retry'

const GOOGLE_AI_STUDIO_RETRY_OPTIONS = {
  ...DEFAULT_RETRY_OPTIONS,
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
}

export class GoogleAIStudioProvider implements LLMProvider {
  name = 'google-ai-studio' as const
  models = googleAIStudioVerifiedModels as Model[]
  
  async validateAPIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      return response.ok
    } catch (error) {
      console.error('Google AI Studio API key validation failed:', error)
      return false
    }
  }

  async complete(request: ChatRequest, apiKey: string, signal?: AbortSignal): Promise<ChatResponse> {
    const contents = this.convertMessagesToGeminiFormat(request.messages)
    
    const executeRequest = async (): Promise<ChatResponse> => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: request.temperature || 0.7,
              maxOutputTokens: request.maxTokens || 2048,
            }
          })
        }
      )

      if (!response.ok) {
        if (isRetryableStatusCode(response.status)) {
          throw new RetryableError(
            `Google AI Studio API error: ${response.status} ${response.statusText}`,
            response.status,
            true
          )
        }
        throw new RetryableError(
          `Google AI Studio API error: ${response.status} ${response.statusText}`,
          response.status,
          false
        )
      }

      const data = await response.json()
      
      if (!data.candidates || data.candidates.length === 0) {
        if (data.promptFeedback?.blockReason) {
          throw new RetryableError(
            `Google AI Studio blocked the request: ${data.promptFeedback.blockReason}`,
            undefined,
            false
          )
        }
        throw new RetryableError('No response from Google AI Studio API', undefined, true)
      }

      const candidate = data.candidates[0]
      
      if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
        throw new RetryableError(
          `Content filtered by Google AI Studio: ${candidate.finishReason}`,
          undefined,
          false
        )
      }
      
      const textPart = candidate.content?.parts?.find((part: any) => part.text)
      let content = textPart?.text || ''
      
      if (candidate.finishReason === 'MAX_TOKENS' && content) {
        content += '\n\n⚠️ *Response was truncated due to token limit.*'
      }
      
      const inputTokens = estimateTokens(request.messages.map(m => m.content).join(' '))
      const outputTokens = estimateTokens(content)
      
      return {
        id: crypto.randomUUID(),
        content,
        model: request.model,
        provider: 'google-ai-studio',
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens
        },
        cost: calculateCost(inputTokens, outputTokens, request.model),
        finishReason: candidate.finishReason || 'stop'
      }
    }

    return withRetry(
      executeRequest,
      GOOGLE_AI_STUDIO_RETRY_OPTIONS,
      (state) => {
        logger.info(`Google AI Studio: Retry attempt ${state.attempt}/${state.maxAttempts}`, {
          error: state.error
        })
      },
      signal
    )
  }

  async* stream(request: ChatRequest, apiKey: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const contents = this.convertMessagesToGeminiFormat(request.messages)
    let lastError: Error | undefined
    let attempt = 0
    const maxAttempts = GOOGLE_AI_STUDIO_RETRY_OPTIONS.maxRetries + 1

    while (attempt < maxAttempts) {
      attempt++
      
      if (signal?.aborted) {
        return
      }

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            signal,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature: request.temperature || 0.7,
                maxOutputTokens: request.maxTokens || 2048,
              }
            })
          }
        )

        if (!response.ok) {
          if (isRetryableStatusCode(response.status)) {
            throw new RetryableError(
              `Google AI Studio API error: ${response.status} ${response.statusText}`,
              response.status,
              true
            )
          }
          throw new RetryableError(
            `Google AI Studio API error: ${response.status} ${response.statusText}`,
            response.status,
            false
          )
        }

        const data = await response.json()
        
        if (!data.candidates || data.candidates.length === 0) {
          if (data.promptFeedback?.blockReason) {
            throw new RetryableError(
              `Google AI Studio blocked the request: ${data.promptFeedback.blockReason}`,
              undefined,
              false
            )
          }
          throw new RetryableError('No response from Google AI Studio API', undefined, true)
        }

        const candidate = data.candidates[0]
        
        if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
          throw new RetryableError(
            `Content filtered by Google AI Studio: ${candidate.finishReason}`,
            undefined,
            false
          )
        }
        
        const textPart = candidate.content?.parts?.find((part: any) => part.text)
        let content = textPart?.text || ''
        
        if (candidate.finishReason === 'MAX_TOKENS' && content) {
          content += '\n\n⚠️ *Response was truncated due to token limit.*'
        }

        const inputTokens = estimateTokens(request.messages.map(m => m.content).join(' '))
        const outputTokens = estimateTokens(content)

        if (content.trim().length > 0) {
          yield {
            id: crypto.randomUUID(),
            content,
            done: false,
            tokens: inputTokens + outputTokens
          }
        } else {
          yield {
            id: crypto.randomUUID(),
            content: '⚠️ *Empty response from Google AI Studio. Try rephrasing your prompt.*',
            done: false
          }
        }

        yield {
          id: crypto.randomUUID(),
          content: '',
          done: true,
          tokens: inputTokens + outputTokens
        }

        return

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (signal?.aborted) {
          logger.debug('Google AI Studio stream aborted')
          return
        }

        const isRetryable = error instanceof RetryableError ? error.isRetryable : false
        const isLastAttempt = attempt >= maxAttempts

        if (!isRetryable || isLastAttempt) {
          logger.debug(`Google AI Studio: Not retrying - ${isLastAttempt ? 'max attempts reached' : 'non-retryable error'}`)
          throw lastError
        }

        const delay = GOOGLE_AI_STUDIO_RETRY_OPTIONS.initialDelayMs * 
          Math.pow(GOOGLE_AI_STUDIO_RETRY_OPTIONS.backoffMultiplier, attempt - 1)
        const jitter = Math.random() * GOOGLE_AI_STUDIO_RETRY_OPTIONS.jitterMs
        const totalDelay = Math.min(delay + jitter, GOOGLE_AI_STUDIO_RETRY_OPTIONS.maxDelayMs)

        logger.info(`Google AI Studio: Retry attempt ${attempt}/${maxAttempts}, waiting ${Math.round(totalDelay)}ms`)

        yield {
          id: crypto.randomUUID(),
          content: '',
          done: false,
          retryStatus: {
            attempt,
            maxAttempts,
            isRetrying: true,
            error: lastError.message
          }
        }

        await new Promise(resolve => setTimeout(resolve, totalDelay))
      }
    }

    throw lastError || new Error('Google AI Studio: Retry failed with unknown error')
  }

  private convertMessagesToGeminiFormat(messages: any[]) {
    const contents = []
    
    for (const message of messages) {
      if (message.role === 'system') {
        contents.push({
          role: 'user',
          parts: [{ text: `System: ${message.content}` }]
        })
      } else if (message.role === 'user') {
        const parts = []
        
        if (message.content) {
          parts.push({ text: message.content })
        }
        
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
