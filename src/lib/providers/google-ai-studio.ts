import { LLMProvider, ChatRequest, ChatResponse, StreamChunk, Model } from '../types'
import { GeminiProvider } from './gemini'
import { googleAIStudioVerifiedModels } from '../models/verified-models'

// Google AI Studio uses the same API as Gemini, just with free tier API keys
// This is a separate provider instance for better UX (showing free tier)
export class GoogleAIStudioProvider implements LLMProvider {
  name = 'google-ai-studio' as const
  models = googleAIStudioVerifiedModels as Model[]
  
  // Use a Gemini instance internally for API calls
  private geminiProvider = new GeminiProvider()
  
  // Delegate all methods to the internal Gemini provider
  async validateAPIKey(apiKey: string): Promise<boolean> {
    return this.geminiProvider.validateAPIKey(apiKey)
  }
  
  async complete(request: ChatRequest, apiKey: string, signal?: AbortSignal): Promise<ChatResponse> {
    const response = await this.geminiProvider.complete(request, apiKey, signal)
    // Update provider name in response
    return {
      ...response,
      provider: 'google-ai-studio'
    }
  }
  
  async* stream(request: ChatRequest, apiKey: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    yield* this.geminiProvider.stream(request, apiKey, signal)
  }
}
