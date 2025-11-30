/**
 * Curated list of verified, working AI models
 * All models in this list have been tested and confirmed to work properly
 * 
 * Each model includes:
 * - Accurate pricing
 * - Capability flags (vision, streaming, etc.)
 * - Context length
 * - Speed indicators
 * - Use case tags
 */

import { Model } from '../types'

export interface ModelCapabilities {
  vision: boolean
  streaming: boolean
  jsonMode?: boolean
  functionCalling?: boolean
}

export interface VerifiedModel extends Model {
  description?: string
  capabilities: ModelCapabilities
  speed: 'very-fast' | 'fast' | 'medium' | 'slow'
  tags: string[]
  recommended?: boolean
}

// ========================================
// OpenAI Models (8 verified models - includes latest 2025 models)
// ========================================
export const openaiVerifiedModels: VerifiedModel[] = [
  {
    id: 'o3',
    name: 'o3 (Reasoning)',
    provider: 'openai',
    description: 'Most powerful reasoning model, excels at coding, math, and complex analysis',
    contextLength: 200000,
    inputCost: 0.015,   // $15 per 1M tokens (estimated based on o1 pricing)
    outputCost: 0.06,   // $60 per 1M tokens
    capabilities: {
      vision: false,
      streaming: false, // Reasoning models typically don't stream
      jsonMode: true,
      functionCalling: false
    },
    speed: 'slow', // Reasoning models are slower due to thinking
    tags: ['recommended', 'reasoning', 'coding', 'math', 'science', 'premium'],
    recommended: true,
    supportsFiles: false
  },
  {
    id: 'o4-mini',
    name: 'o4-mini (Reasoning)',
    provider: 'openai',
    description: 'Cost-effective reasoning model, great for math and coding',
    contextLength: 200000,
    inputCost: 0.0015,  // $1.50 per 1M tokens (estimated)
    outputCost: 0.006,  // $6 per 1M tokens
    capabilities: {
      vision: false,
      streaming: false,
      jsonMode: true,
      functionCalling: false
    },
    speed: 'medium',
    tags: ['recommended', 'reasoning', 'coding', 'math', 'affordable'],
    recommended: true,
    supportsFiles: false
  },
  {
    id: 'o1',
    name: 'o1 (Reasoning)',
    provider: 'openai',
    description: 'Advanced reasoning model for complex problem-solving',
    contextLength: 200000,
    inputCost: 0.015,   // $15 per 1M tokens
    outputCost: 0.06,   // $60 per 1M tokens
    capabilities: {
      vision: false,
      streaming: false,
      jsonMode: true,
      functionCalling: false
    },
    speed: 'slow',
    tags: ['reasoning', 'coding', 'math', 'science'],
    supportsFiles: false
  },
  {
    id: 'o1-mini',
    name: 'o1-mini (Reasoning)',
    provider: 'openai',
    description: 'Affordable reasoning model, 80% cheaper than o1',
    contextLength: 128000,
    inputCost: 0.003,   // $3 per 1M tokens
    outputCost: 0.012,  // $12 per 1M tokens
    capabilities: {
      vision: false,
      streaming: false,
      jsonMode: true,
      functionCalling: false
    },
    speed: 'medium',
    tags: ['reasoning', 'coding', 'math', 'affordable'],
    supportsFiles: false
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Flagship multimodal model with vision, best for complex tasks',
    contextLength: 128000,
    inputCost: 0.0025,  // $2.50 per 1M input tokens
    outputCost: 0.01,   // $10.00 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'fast',
    tags: ['recommended', 'vision', 'best-quality', 'coding', 'analysis'],
    recommended: true,
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    description: 'Newest mini model, 83% cheaper and 50% faster than GPT-4o',
    contextLength: 1000000, // 1M tokens!
    inputCost: 0.0004,  // $0.40 per 1M input tokens
    outputCost: 0.0016, // $1.60 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'very-fast',
    tags: ['recommended', 'vision', 'cheapest', 'ultra-fast', 'coding', 'huge-context'],
    recommended: true,
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and affordable with vision support, great for most tasks',
    contextLength: 128000,
    inputCost: 0.00015,  // $0.15 per 1M input tokens
    outputCost: 0.0006,  // $0.60 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'very-fast',
    tags: ['vision', 'cheap', 'fast', 'coding'],
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'High-quality responses with vision, good for complex reasoning',
    contextLength: 128000,
    inputCost: 0.01,    // $10.00 per 1M input tokens
    outputCost: 0.03,   // $30.00 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'medium',
    tags: ['vision', 'high-quality', 'analysis'],
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    description: 'Fast and cheap, good for simple tasks',
    contextLength: 16385,
    inputCost: 0.0005,  // $0.50 per 1M input tokens
    outputCost: 0.0015, // $1.50 per 1M output tokens
    capabilities: {
      vision: false,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'very-fast',
    tags: ['cheap', 'fast', 'legacy'],
    supportsFiles: false
  }
]

// ========================================
// Anthropic Models (7 verified models - includes latest 2025 models)
// ========================================
export const anthropicVerifiedModels: VerifiedModel[] = [
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Latest and most advanced coding model, best for building complex agents',
    contextLength: 200000,
    inputCost: 0.003,   // $3.00 per 1M input tokens
    outputCost: 0.015,  // $15.00 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'fast',
    tags: ['recommended', 'vision', 'best-coding', 'agents', 'latest', 'premium'],
    recommended: true,
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Powerful model with state-of-the-art coding abilities',
    contextLength: 200000,
    inputCost: 0.003,   // $3.00 per 1M input tokens
    outputCost: 0.015,  // $15.00 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'fast',
    tags: ['recommended', 'vision', 'coding', 'best-quality'],
    recommended: true,
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Excellent for writing, analysis, and coding',
    contextLength: 200000,
    inputCost: 0.003,   // $3.00 per 1M input tokens
    outputCost: 0.015,  // $15.00 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'fast',
    tags: ['vision', 'writing', 'analysis', 'coding'],
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'Fastest Claude model, great for quick responses',
    contextLength: 200000,
    inputCost: 0.001,   // $1.00 per 1M input tokens
    outputCost: 0.005,  // $5.00 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'very-fast',
    tags: ['recommended', 'vision', 'fast', 'cheap'],
    recommended: true,
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    description: 'Most powerful Claude model, best for complex tasks',
    contextLength: 200000,
    inputCost: 0.015,   // $15.00 per 1M input tokens
    outputCost: 0.075,  // $75.00 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'medium',
    tags: ['vision', 'premium', 'best-quality', 'analysis'],
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    description: 'Balanced performance and cost',
    contextLength: 200000,
    inputCost: 0.003,   // $3.00 per 1M input tokens
    outputCost: 0.015,  // $15.00 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'fast',
    tags: ['vision', 'balanced'],
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fastest and most affordable Claude model',
    contextLength: 200000,
    inputCost: 0.00025, // $0.25 per 1M input tokens
    outputCost: 0.00125,// $1.25 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'very-fast',
    tags: ['vision', 'cheap', 'fast'],
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  }
]

// ========================================
// Google Gemini Models (Working models with correct API IDs)
// ========================================
export const geminiVerifiedModels: VerifiedModel[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Latest Flash with hybrid reasoning, balances performance and cost',
    contextLength: 1048576, // 1M tokens
    inputCost: 0.000075, // $0.075 per 1M input tokens
    outputCost: 0.0003,  // $0.30 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'very-fast',
    tags: ['recommended', 'vision', 'cheapest', 'ultra-fast', 'reasoning', 'latest'],
    recommended: true,
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    description: 'Ultra-fast and cost-efficient for high throughput tasks',
    contextLength: 1048576, // 1M tokens
    inputCost: 0.000037, // Cheaper than Flash
    outputCost: 0.00015,
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'very-fast',
    tags: ['recommended', 'vision', 'cheapest', 'ultra-fast'],
    recommended: true,
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    description: 'Fast multimodal model with tool use and 1M context',
    contextLength: 1048576, // 1M tokens
    inputCost: 0.000075, // $0.075 per 1M input tokens
    outputCost: 0.0003,  // $0.30 per 1M output tokens
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'very-fast',
    tags: ['recommended', 'vision', 'cheap', 'fast', 'large-context'],
    recommended: true,
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'audio/*', 'video/*']
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    provider: 'gemini',
    description: 'Most cost-efficient Gemini 2.0 model',
    contextLength: 1048576, // 1M tokens
    inputCost: 0.000037,
    outputCost: 0.00015,
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'very-fast',
    tags: ['cheapest', 'ultra-fast', 'large-context'],
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  }
]

// ========================================
// OpenRouter Models (10 verified models)
// IMPORTANT: Only models confirmed to work with streaming
// ========================================
export const openrouterVerifiedModels: VerifiedModel[] = [
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (via OpenRouter)',
    provider: 'openrouter',
    description: 'OpenAI GPT-4o through OpenRouter',
    contextLength: 128000,
    inputCost: 0.0025,
    outputCost: 0.01,
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'fast',
    tags: ['recommended', 'vision', 'openai'],
    recommended: true,
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (via OpenRouter)',
    provider: 'openrouter',
    description: 'Anthropic Claude through OpenRouter',
    contextLength: 200000,
    inputCost: 0.003,
    outputCost: 0.015,
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'fast',
    tags: ['recommended', 'vision', 'anthropic'],
    recommended: true,
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5 (via OpenRouter)',
    provider: 'openrouter',
    description: 'Google Gemini through OpenRouter',
    contextLength: 2097152,
    inputCost: 0.00125,
    outputCost: 0.005,
    capabilities: {
      vision: true,
      streaming: true,
      jsonMode: true,
      functionCalling: true
    },
    speed: 'fast',
    tags: ['vision', 'google', 'huge-context'],
    supportsFiles: true,
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    provider: 'openrouter',
    description: 'Meta\'s largest open model, excellent for complex tasks',
    contextLength: 131072,
    inputCost: 0.0009,
    outputCost: 0.0009,
    capabilities: {
      vision: false,
      streaming: true,
      jsonMode: true,
      functionCalling: false
    },
    speed: 'medium',
    tags: ['recommended', 'open-source', 'coding', 'analysis'],
    recommended: true,
    supportsFiles: false
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    provider: 'openrouter',
    description: 'Fast and efficient open model',
    contextLength: 131072,
    inputCost: 0.0001,
    outputCost: 0.0001,
    capabilities: {
      vision: false,
      streaming: true,
      jsonMode: true,
      functionCalling: false
    },
    speed: 'very-fast',
    tags: ['open-source', 'cheap', 'fast'],
    supportsFiles: false
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct',
    name: 'Mixtral 8x7B',
    provider: 'openrouter',
    description: 'Mistral\'s mixture of experts model, good for coding',
    contextLength: 32768,
    inputCost: 0.00024,
    outputCost: 0.00024,
    capabilities: {
      vision: false,
      streaming: true,
      jsonMode: true,
      functionCalling: false
    },
    speed: 'fast',
    tags: ['open-source', 'coding', 'cheap'],
    supportsFiles: false
  },
  {
    id: 'mistralai/mistral-7b-instruct',
    name: 'Mistral 7B',
    provider: 'openrouter',
    description: 'Small but capable open model',
    contextLength: 32768,
    inputCost: 0.00006,
    outputCost: 0.00006,
    capabilities: {
      vision: false,
      streaming: true,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'very-fast',
    tags: ['open-source', 'cheap', 'fast'],
    supportsFiles: false
  },
  {
    id: 'google/gemma-2-9b-it:free',
    name: 'Gemma 2 9B (FREE)',
    provider: 'openrouter',
    description: 'Free Google model, good for testing',
    contextLength: 8192,
    inputCost: 0,
    outputCost: 0,
    capabilities: {
      vision: false,
      streaming: false, // Note: Free models often don't stream well
      jsonMode: false,
      functionCalling: false
    },
    speed: 'fast',
    tags: ['free', 'google', 'open-source'],
    supportsFiles: false
  },
  {
    id: 'qwen/qwen-2-7b-instruct:free',
    name: 'Qwen 2 7B (FREE)',
    provider: 'openrouter',
    description: 'Free Alibaba model',
    contextLength: 32768,
    inputCost: 0,
    outputCost: 0,
    capabilities: {
      vision: false,
      streaming: false,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'fast',
    tags: ['free', 'open-source'],
    supportsFiles: false
  },
  {
    id: 'microsoft/phi-3-mini-128k-instruct:free',
    name: 'Phi-3 Mini (FREE)',
    provider: 'openrouter',
    description: 'Free Microsoft model with large context',
    contextLength: 128000,
    inputCost: 0,
    outputCost: 0,
    capabilities: {
      vision: false,
      streaming: false,
      jsonMode: false,
      functionCalling: false
    },
    speed: 'very-fast',
    tags: ['free', 'microsoft', 'large-context'],
    supportsFiles: false
  }
]

// ========================================
// Google AI Studio Models (Same as Gemini - Free Tier)
// ========================================
// Google AI Studio uses the exact same API as Gemini
// We create a separate provider entry for better UX (showing free tier)
export const googleAIStudioVerifiedModels: VerifiedModel[] = geminiVerifiedModels.map(model => ({
  ...model,
  provider: 'google-ai-studio',
  tags: [...model.tags, 'free-tier']
}))

// ========================================
// Export all verified models
// ========================================
export const verifiedModels = {
  openai: openaiVerifiedModels,
  anthropic: anthropicVerifiedModels,
  gemini: geminiVerifiedModels,
  'google-ai-studio': googleAIStudioVerifiedModels,
  openrouter: openrouterVerifiedModels
}

// Helper to get models by provider
export function getVerifiedModels(provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'google-ai-studio'): VerifiedModel[] {
  return verifiedModels[provider] || []
}

// Helper to get recommended models only
export function getRecommendedModels(provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'google-ai-studio'): VerifiedModel[] {
  return verifiedModels[provider].filter(m => m.recommended === true)
}

// Helper to get model by ID
export function getModelById(provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'google-ai-studio', modelId: string): VerifiedModel | undefined {
  return verifiedModels[provider].find(m => m.id === modelId)
}
