export type PromptType = 
  | 'coding'
  | 'writing'
  | 'analysis' 
  | 'creative'
  | 'question'
  | 'instruction'
  | 'conversation'
  | 'research'
  | 'general'

export type EnhancementType = 
  | 'detailed'
  | 'focused' 
  | 'provider-optimized'
  | 'structured'
  | 'contextual'

export interface PromptAnalysis {
  type: PromptType
  confidence: number
  issues: string[]
  suggestions: string[]
  qualityScore: number
  wordCount: number
  hasContext: boolean
  hasConstraints: boolean
  hasExamples: boolean
}

export interface EnhancedPrompt {
  id: string
  type: EnhancementType
  title: string
  description: string
  content: string
  provider?: string
  qualityScore: number
  improvements: string[]
}

export interface PromptEnhancementRequest {
  originalPrompt: string
  targetProviders?: string[]
  preferredTypes?: EnhancementType[]
  context?: string
}

export interface PromptEnhancementResponse {
  analysis: PromptAnalysis
  enhancements: EnhancedPrompt[]
  originalPrompt: string
}