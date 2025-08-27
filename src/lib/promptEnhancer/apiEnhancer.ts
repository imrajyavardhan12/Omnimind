import { useSettingsStore } from '@/lib/stores/settings'

export interface ApiEnhancementRequest {
  originalPrompt: string
  preferredProvider?: string
}

export interface ApiEnhancementResponse {
  enhancedPrompt: string
  provider: string
  success: boolean
  error?: string
}

export class ApiPromptEnhancer {
  private static readonly ENHANCEMENT_PROMPT = `You are a prompt engineering expert. Your task is to improve the given prompt to make it more effective for AI language models.

Rules for improvement:
1. Make the prompt clearer and more specific
2. Add necessary context and constraints
3. Structure the request for better results
4. Maintain the original intent
5. Keep it concise but comprehensive
6. Don't change the core request, just improve how it's presented

Original prompt: {ORIGINAL_PROMPT}

Please respond with ONLY the improved prompt, no explanations or additional text.`

  static async enhance(request: ApiEnhancementRequest): Promise<ApiEnhancementResponse> {
    const { originalPrompt, preferredProvider } = request
    
    // Get available providers and API keys
    const { providers, getApiKey } = useSettingsStore.getState()
    
    // Determine which provider to use
    const availableProviders = Object.entries(providers)
      .filter(([_, config]) => config.enabled)
      .map(([name, _]) => name)
    
    if (availableProviders.length === 0) {
      return {
        enhancedPrompt: originalPrompt,
        provider: 'none',
        success: false,
        error: 'No API providers configured'
      }
    }
    
    // Use preferred provider or fallback to first available
    const provider = preferredProvider && availableProviders.includes(preferredProvider) 
      ? preferredProvider 
      : availableProviders[0]
    
    const apiKey = getApiKey(provider as any)
    if (!apiKey) {
      return {
        enhancedPrompt: originalPrompt,
        provider,
        success: false,
        error: `No API key configured for ${provider}`
      }
    }
    
    try {
      // Create the enhancement prompt
      const enhancementPrompt = this.ENHANCEMENT_PROMPT.replace('{ORIGINAL_PROMPT}', originalPrompt)
      
      // Get the appropriate model for the provider
      const model = this.getModelForProvider(provider)
      
      // Make API call
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [`x-api-key-${provider}`]: apiKey
        },
        body: JSON.stringify({
          messages: [{
            id: crypto.randomUUID(),
            role: 'user',
            content: enhancementPrompt,
            timestamp: Date.now()
          }],
          model,
          temperature: 0.3, // Low temperature for consistent improvements
          maxTokens: 500,
          stream: false,
          provider
        })
      })
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`)
      }
      
      const data = await response.json()
      const enhancedPrompt = data.content?.trim() || originalPrompt
      
      return {
        enhancedPrompt,
        provider,
        success: true
      }
      
    } catch (error) {
      console.error('Enhancement API call failed:', error)
      return {
        enhancedPrompt: originalPrompt,
        provider,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  private static getModelForProvider(provider: string): string {
    // Use fast, cost-effective models for prompt enhancement
    const modelMap: Record<string, string> = {
      'openai': 'gpt-4o-mini',
      'anthropic': 'claude-3-haiku-20240307',
      'gemini': 'gemini-1.5-flash',
      'openrouter': 'anthropic/claude-3-haiku'
    }
    
    return modelMap[provider] || 'gpt-4o-mini'
  }
}