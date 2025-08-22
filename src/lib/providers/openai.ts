import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model } from '../types'
import { estimateTokens, calculateCost } from '../utils/tokenizer'

// Fallback models when API is not available
export const openaiModels: Model[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextLength: 128000,
    inputCost: 0.0025,
    outputCost: 0.01
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextLength: 128000,
    inputCost: 0.00015,
    outputCost: 0.0006
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextLength: 128000,
    inputCost: 0.01,
    outputCost: 0.03
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextLength: 16385,
    inputCost: 0.0005,
    outputCost: 0.0015
  }
]

export class OpenAIProvider implements LLMProvider {
  name = 'openai' as const
  models = openaiModels

  async validateAPIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      return response.ok
    } catch (error) {
      console.error('OpenAI API key validation failed:', error)
      return false
    }
  }

  async complete(request: ChatRequest, apiKey: string): Promise<ChatResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map(msg => {
          // Handle multimodal messages with attachments
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
        max_tokens: request.maxTokens || 1000,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
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
      provider: 'openai',
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
        max_tokens: request.maxTokens || 1000,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
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
