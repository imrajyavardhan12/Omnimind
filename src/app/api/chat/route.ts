import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { OpenAIProvider } from '@/lib/providers/openai'
import { AnthropicProvider } from '@/lib/providers/anthropic'
import { GeminiProvider } from '@/lib/providers/gemini'
import { GoogleAIStudioProvider } from '@/lib/providers/google-ai-studio'
import { OpenRouterProvider } from '@/lib/providers/openrouter'
import { ChatRequest, ProviderName } from '@/lib/types'
import { logger } from '@/lib/utils/logger'

const providers = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  gemini: new GeminiProvider(),
  'google-ai-studio': new GoogleAIStudioProvider(),
  openrouter: new OpenRouterProvider()
}

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.number(),
    provider: z.string().optional(),
    model: z.string().optional(),
    attachments: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      size: z.number(),
      data: z.string()
    })).optional()
  })),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'openrouter', 'google-ai-studio']),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(8192).optional(), // Increased to support longer responses
  stream: z.boolean().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, provider, model, temperature, maxTokens, stream } = chatRequestSchema.parse(body)
    
    // Get API key from headers or use server-side key for free tier
    let apiKey = request.headers.get(`x-api-key-${provider}`)
    
    // For Google AI Studio, use server-side API key if user hasn't provided their own
    if (provider === 'google-ai-studio' && !apiKey) {
      apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY || null
      logger.debug('Using server-side Google AI Studio API key (free tier)')
    }
    
    if (!apiKey) {
      return NextResponse.json(
        { error: `API key required for ${provider}` },
        { status: 400 }
      )
    }

    // Get provider instance
    const providerInstance = providers[provider as keyof typeof providers]
    if (!providerInstance) {
      return NextResponse.json(
        { error: `Provider ${provider} not supported yet` },
        { status: 400 }
      )
    }

    const chatRequest: ChatRequest = {
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        attachments: msg.attachments
      })),
      model,
      temperature,
      maxTokens,
      stream
    }

    if (stream) {
      // Handle streaming response
      const encoder = new TextEncoder()
      
      // Create an abort controller that follows the request's abort signal
      const abortController = new AbortController()
      
      // Listen to the request's abort signal
      request.signal.addEventListener('abort', () => {
        logger.debug(`Request aborted for ${provider}`)
        abortController.abort()
      })
      
      const streamResponse = new ReadableStream({
        async start(controller) {
          let isStreamClosed = false
          
          const closeStream = () => {
            if (!isStreamClosed) {
              try {
                controller.close()
                isStreamClosed = true
              } catch (error) {
                // Controller might already be closed, ignore
                logger.debug('Stream already closed')
              }
            }
          }

          try {
            // Pass the abort signal to the provider's stream method
            for await (const chunk of providerInstance.stream(chatRequest, apiKey, abortController.signal)) {
              // Check if the request was aborted
              if (abortController.signal.aborted || request.signal.aborted) {
                logger.debug(`Stream aborted for ${provider}`)
                closeStream()
                break
              }
              
              if (isStreamClosed) {
                break
              }
              
              try {
                const data = JSON.stringify(chunk)
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                
                if (chunk.done) {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  closeStream()
                  break
                }
              } catch (enqueueError) {
                if (!isStreamClosed) {
                  console.error('Enqueue error:', enqueueError)
                  closeStream()
                }
                break
              }
            }
          } catch (error) {
            console.error('Streaming error:', error)
            
            // Check if it's an abort error (user stopped the request)
            if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
              logger.debug(`Stream aborted by user for ${provider}`)
              closeStream()
              return
            }
            
            if (!isStreamClosed) {
              try {
                const errorChunk = {
                  id: crypto.randomUUID(),
                  content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  done: true
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`))
              } catch (controllerError) {
                console.error('Error sending error chunk:', controllerError)
              }
            }
          } finally {
            closeStream()
          }
        },
        cancel() {
          logger.debug(`Stream cancelled for ${provider}`)
          abortController.abort()
        }
      })

      return new Response(streamResponse, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    } else {
      // Handle non-streaming response
      const response = await providerInstance.complete(chatRequest, apiKey, request.signal)
      return NextResponse.json(response)
    }
  } catch (error) {
    console.error('Chat API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Chat API is running',
    supportedProviders: Object.keys(providers)
  })
}
