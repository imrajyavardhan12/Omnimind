import { NextResponse } from 'next/server'

// Type definitions for API responses
interface OpenAIModel {
  id: string
  object: string
  created: number
  owned_by: string
}

interface OpenAIModelsResponse {
  data: OpenAIModel[]
  object: string
}

interface AnthropicModel {
  id: string
  name: string
  provider: string
  contextLength: number
  inputCost: number
  outputCost: number
}

interface GeminiModel {
  name: string
  displayName?: string
  supportedGenerationMethods?: string[]
  inputTokenLimit?: number
}

interface GeminiModelsResponse {
  models: GeminiModel[]
}

interface OpenRouterModel {
  id: string
  name: string
  context_length?: number
  pricing?: {
    prompt: string | number
    completion: string | number
  }
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[]
}

interface FormattedModel {
  id: string
  name: string
  provider: string
  contextLength: number
  inputCost: number
  outputCost: number
  isFree?: boolean
}

// Fetch OpenAI models
async function fetchOpenAIModels(apiKey: string): Promise<FormattedModel[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) return []
    
    const data: OpenAIModelsResponse = await response.json()
    
    // Filter for chat models only
    const chatModels = data.data.filter((model: OpenAIModel) => 
      model.id.includes('gpt') && !model.id.includes('instruct')
    )
    
    // Map to our format with cost estimates
    return chatModels.map((model: OpenAIModel): FormattedModel => ({
      id: model.id,
      name: model.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      provider: 'openai',
      contextLength: getOpenAIContextLength(model.id),
      inputCost: getOpenAIInputCost(model.id),
      outputCost: getOpenAIOutputCost(model.id)
    }))
  } catch (error) {
    console.error('Error fetching OpenAI models:', error)
    return []
  }
}

// Helper functions for OpenAI pricing (based on latest pricing)
function getOpenAIContextLength(modelId: string): number {
  const contextMap: Record<string, number> = {
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4-turbo-preview': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
    'gpt-3.5-turbo-16k': 16385,
  }
  return contextMap[modelId] || 4096
}

function getOpenAIInputCost(modelId: string): number {
  const costMap: Record<string, number> = {
    'gpt-4o': 0.0025,
    'gpt-4o-mini': 0.00015,
    'gpt-4-turbo': 0.01,
    'gpt-4-turbo-preview': 0.01,
    'gpt-4': 0.03,
    'gpt-3.5-turbo': 0.0005,
    'gpt-3.5-turbo-16k': 0.003,
  }
  return costMap[modelId] || 0.001
}

function getOpenAIOutputCost(modelId: string): number {
  const costMap: Record<string, number> = {
    'gpt-4o': 0.01,
    'gpt-4o-mini': 0.0006,
    'gpt-4-turbo': 0.03,
    'gpt-4-turbo-preview': 0.03,
    'gpt-4': 0.06,
    'gpt-3.5-turbo': 0.0015,
    'gpt-3.5-turbo-16k': 0.004,
  }
  return costMap[modelId] || 0.002
}

// Fetch Anthropic models
async function fetchAnthropicModels(apiKey: string): Promise<AnthropicModel[]> {
  // Anthropic doesn't have a models endpoint, so we'll use a curated list of available models
  // We can validate the API key works with a test request
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      })
    })
    
    // If API key is valid, return available models
    if (response.status === 401) return []
    
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet (Latest)',
        provider: 'anthropic',
        contextLength: 200000,
        inputCost: 0.003,
        outputCost: 0.015
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        contextLength: 200000,
        inputCost: 0.001,
        outputCost: 0.005
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        contextLength: 200000,
        inputCost: 0.015,
        outputCost: 0.075
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        contextLength: 200000,
        inputCost: 0.003,
        outputCost: 0.015
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        contextLength: 200000,
        inputCost: 0.00025,
        outputCost: 0.00125
      }
    ]
  } catch (error) {
    console.error('Error validating Anthropic API:', error)
    return []
  }
}

// Fetch Google Gemini models
async function fetchGeminiModels(apiKey: string): Promise<FormattedModel[]> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    
    if (!response.ok) return []
    
    const data: GeminiModelsResponse = await response.json()
    
    // Filter for Gemini models that support generateContent
    const geminiModels = data.models.filter((model: GeminiModel) => 
      model.supportedGenerationMethods?.includes('generateContent')
    )
    
    return geminiModels.map((model: GeminiModel): FormattedModel => ({
      id: model.name.replace('models/', ''),
      name: formatGeminiModelName(model.displayName || model.name),
      provider: 'gemini',
      contextLength: model.inputTokenLimit || 32768,
      inputCost: getGeminiInputCost(model.name),
      outputCost: getGeminiOutputCost(model.name)
    }))
  } catch (error) {
    console.error('Error fetching Gemini models:', error)
    return []
  }
}

function formatGeminiModelName(name: string): string {
  return name
    .replace('models/', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

function getGeminiInputCost(modelId: string): number {
  if (modelId.includes('gemini-1.5-pro')) return 0.00125
  if (modelId.includes('gemini-1.5-flash')) return 0.000075
  if (modelId.includes('gemini-pro')) return 0.0005
  return 0.0001
}

function getGeminiOutputCost(modelId: string): number {
  if (modelId.includes('gemini-1.5-pro')) return 0.005
  if (modelId.includes('gemini-1.5-flash')) return 0.0003
  if (modelId.includes('gemini-pro')) return 0.0015
  return 0.0003
}

// Fetch OpenRouter models
async function fetchOpenRouterModels(apiKey: string): Promise<FormattedModel[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) return []
    
    const data: OpenRouterModelsResponse = await response.json()
    
    // Map models and mark free ones
    return data.data.map((model: OpenRouterModel): FormattedModel => {
      const isFree = model.pricing?.prompt === '0' || 
                     model.pricing?.prompt === 0 || 
                     model.id.includes(':free')
      
      return {
        id: model.id,
        name: `${model.name}${isFree ? ' (FREE)' : ''}`,
        provider: 'openrouter',
        contextLength: model.context_length || 4096,
        inputCost: parseFloat(String(model.pricing?.prompt || 0)) * 1000000, // Convert to per million tokens
        outputCost: parseFloat(String(model.pricing?.completion || 0)) * 1000000,
        isFree
      }
    }).sort((a: FormattedModel, b: FormattedModel) => {
      // Sort free models first
      if (a.isFree && !b.isFree) return -1
      if (!a.isFree && b.isFree) return 1
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error)
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')
  const apiKey = request.headers.get(`x-api-key-${provider}`)
  
  if (!provider || !apiKey) {
    return NextResponse.json({ error: 'Provider and API key required' }, { status: 400 })
  }
  
  let models = []
  
  switch (provider) {
    case 'openai':
      models = await fetchOpenAIModels(apiKey)
      break
    case 'anthropic':
      models = await fetchAnthropicModels(apiKey)
      break
    case 'gemini':
      models = await fetchGeminiModels(apiKey)
      break
    case 'openrouter':
      models = await fetchOpenRouterModels(apiKey)
      break
    default:
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }
  
  return NextResponse.json({ models })
}
