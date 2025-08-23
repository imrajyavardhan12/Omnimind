import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model } from '../types'
import { estimateTokens, calculateCost } from '../utils/tokenizer'

// Fallback models when API is not available - using correct model IDs
export const geminiModels: Model[] = [
  {
    id: 'gemini-1.5-pro',
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
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('Gemini API response:', data)
    
    if (!data.candidates || data.candidates.length === 0) {
      console.error('No candidates in response:', data)
      throw new Error('No response from Gemini API - no candidates found')
    }

    const candidate = data.candidates[0]
    
    // Check for safety filters or blocked content
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
      throw new Error(`Content blocked by Gemini safety filters: ${candidate.finishReason}`)
    }
    
    const content = candidate.content?.parts?.[0]?.text || ''
    
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
    // Convert messages to Gemini format
    const contents = this.convertMessagesToGeminiFormat(request.messages)
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${request.model}:streamGenerateContent?key=${apiKey}`, {
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

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let braceCount = 0
    let inJsonObject = false
    let jsonBuffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        
        // Process character by character to find complete JSON objects
        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i]
          
          if (char === '{') {
            if (braceCount === 0) {
              inJsonObject = true
              jsonBuffer = ''
            }
            braceCount++
          }
          
          if (inJsonObject) {
            jsonBuffer += char
          }
          
          if (char === '}') {
            braceCount--
            if (braceCount === 0 && inJsonObject) {
              // We have a complete JSON object
              try {
                const parsed = JSON.parse(jsonBuffer)
                
                if (parsed.candidates && parsed.candidates[0]) {
                  const candidate = parsed.candidates[0]
                  
                  // Check for safety blocks
                  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
                    yield {
                      id: crypto.randomUUID(),
                      content: 'Content blocked by safety filters',
                      done: true
                    }
                    return
                  }
                  
                  // Stream content if available
                  if (candidate.content?.parts?.[0]?.text) {
                    yield {
                      id: crypto.randomUUID(),
                      content: candidate.content.parts[0].text,
                      done: false
                    }
                  }
                  
                  // Check for completion
                  if (candidate.finishReason && candidate.finishReason === 'STOP') {
                    yield {
                      id: crypto.randomUUID(),
                      content: '',
                      done: true
                    }
                    return
                  }
                }
              } catch (error) {
                console.error('Failed to parse Gemini stream JSON:', error)
              }
              
              inJsonObject = false
              jsonBuffer = ''
            }
          }
        }
        
        // Clear the processed buffer
        buffer = ''
      }
    } finally {
      reader.releaseLock()
    }
  }

  private convertMessagesToGeminiFormat(messages: any[]) {
    const contents = []
    let systemPrompt = ''
    
    // Extract system message if it exists
    const systemMessage = messages.find(m => m.role === 'system')
    if (systemMessage) {
      systemPrompt = systemMessage.content + '\n\n'
    }
    
    // Convert other messages
    for (const message of messages) {
      if (message.role === 'system') {
        continue // Already handled above
      } else if (message.role === 'user') {
        // Add system prompt to first user message
        const content = contents.length === 0 && systemPrompt 
          ? systemPrompt + message.content 
          : message.content
          
        contents.push({
          role: 'user',
          parts: [{ text: content }]
        })
      } else if (message.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: message.content }]
        })
      }
    }
    
    // Ensure we have at least one message
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt || 'Hello' }]
      })
    }
    
    return contents
  }
}
