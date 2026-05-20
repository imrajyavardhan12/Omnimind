// Main exports for the prompt enhancement system
export { PromptEnhancer } from './enhancer'
export { PromptAnalyzer } from './analyzer'
export { PromptTemplates } from './templates'

export type {
  PromptType,
  EnhancementType,
  PromptAnalysis,
  EnhancedPrompt,
  PromptEnhancementRequest,
  PromptEnhancementResponse
} from './types'

export type { PromptTemplate } from './templates'

// Convenience function for quick enhancement
import { PromptEnhancer as PE } from './enhancer'

export const enhancePrompt = (originalPrompt: string, targetProviders?: string[]) => {
  return PE.enhance({
    originalPrompt,
    targetProviders
  })
}