/**
 * Token estimation using js-tiktoken for accurate counting
 * Falls back to simple estimation if tokenizer fails
 */

import { Tiktoken, encodingForModel } from 'js-tiktoken'

// Cache for encoders to avoid recreating them
let cachedEncoder: Tiktoken | null = null

/**
 * Get accurate token count using tiktoken
 * Falls back to simple estimation on error
 */
export function estimateTokens(text: string, model: string = 'gpt-4'): number {
  try {
    // Use cached encoder or create new one
    if (!cachedEncoder) {
      try {
        cachedEncoder = encodingForModel(model as any)
      } catch (error) {
        // If model not supported, use gpt-4 encoding (cl100k_base)
        cachedEncoder = encodingForModel('gpt-4' as any)
      }
    }
    
    if (cachedEncoder) {
      const tokens = cachedEncoder.encode(text)
      return tokens.length
    }
    
    // Fallback if encoder creation failed
    return Math.ceil(text.length / 4)
  } catch (error) {
    // Fallback to simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }
}

/**
 * Simple token estimation without tiktoken (fallback)
 * ~4 characters per token for English text
 */
export function estimateTokensSimple(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Clear the cached encoder
 */
export function clearTokenizerCache(): void {
  cachedEncoder = null
}

export function calculateCost(inputTokens: number, outputTokens: number, model: string): number {
  const costs = {
    // OpenAI pricing (per 1K tokens) - Updated with latest models
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
    
    // Anthropic pricing (per 1K tokens)
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    
    // Gemini pricing (per 1K tokens)
    'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
    'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
    'gemini-pro': { input: 0.0005, output: 0.0015 },
    
    // OpenRouter pricing (per 1K tokens)
    'openai/gpt-4': { input: 0.03, output: 0.06 },
    'openai/gpt-4-turbo': { input: 0.01, output: 0.03 },
    'openai/gpt-3.5-turbo': { input: 0.001, output: 0.002 },
    'anthropic/claude-3-5-sonnet': { input: 0.003, output: 0.015 },
    'anthropic/claude-3-opus': { input: 0.015, output: 0.075 },
    'meta-llama/llama-3.1-70b-instruct': { input: 0.0009, output: 0.0009 },
    'meta-llama/llama-3.1-8b-instruct': { input: 0.0001, output: 0.0001 },
    'mistralai/mistral-large': { input: 0.008, output: 0.024 },
    'mistralai/mistral-medium': { input: 0.0027, output: 0.0081 },
    'google/gemini-pro': { input: 0.000125, output: 0.000375 },
    
    // Default fallback
    'default': { input: 0.001, output: 0.002 }
  }
  
  const modelCosts = costs[model as keyof typeof costs] || costs.default
  
  const inputCost = (inputTokens / 1000) * modelCosts.input
  const outputCost = (outputTokens / 1000) * modelCosts.output
  
  return inputCost + outputCost
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}