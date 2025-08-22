import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { OpenAIProvider } from '@/lib/providers/openai'
import { AnthropicProvider } from '@/lib/providers/anthropic'
import { GeminiProvider } from '@/lib/providers/gemini'
import { OpenRouterProvider } from '@/lib/providers/openrouter'
import { ChatRequest, ProviderName } from '@/lib/types'

const providers = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  gemini: new GeminiProvider(),
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
  provider: z.enum(['openai', 'anthropic', 'gemini', 'openrouter']),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
  stream: z.boolean().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, provider, model, temperature, maxTokens, stream } = chatRequestSchema.parse(body)
    
    // Get API key from headers
    const apiKey = request.headers.get(`x-api-key-${provider}`)
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
      
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of providerInstance.stream(chatRequest, apiKey)) {
              if (controller.desiredSize === null) {
                // Controller is already closed
                break
              }
              
              const data = JSON.stringify(chunk)
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              
              if (chunk.done) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                break
              }
            }
          } catch (error) {
            console.error('Streaming error:', error)
            if (controller.desiredSize !== null) {
              try {
                const errorChunk = {
                  id: crypto.randomUUID(),
                  content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  done: true
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`))
              } catch (controllerError) {
                console.error('Controller error:', controllerError)
              }
            }
          } finally {
            try {
              if (controller.desiredSize !== null) {
                controller.close()
              }
            } catch (closeError) {
              console.error('Controller close error:', closeError)
            }
          }
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
      const response = await providerInstance.complete(chatRequest, apiKey)
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