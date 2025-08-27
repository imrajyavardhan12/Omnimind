import { PromptType, PromptAnalysis } from './types'

export class PromptAnalyzer {
  private static readonly patterns: Record<string, RegExp[]> = {
    coding: [
      /\b(code|function|class|algorithm|debug|implement|write|create)\b/i,
      /\b(javascript|python|react|typescript|html|css|api)\b/i,
      /\b(array|object|variable|loop|condition)\b/i
    ],
    writing: [
      /\b(write|essay|article|blog|content|story|paragraph)\b/i,
      /\b(tone|style|audience|format|structure)\b/i,
      /\b(draft|edit|proofread|rewrite)\b/i
    ],
    analysis: [
      /\b(analyze|compare|evaluate|examine|assess|review)\b/i,
      /\b(data|statistics|trends|patterns|insights)\b/i,
      /\b(pros and cons|advantages|disadvantages|benefits)\b/i
    ],
    creative: [
      /\b(creative|imagine|brainstorm|idea|concept|design)\b/i,
      /\b(story|character|plot|scene|dialogue)\b/i,
      /\b(innovative|original|unique|artistic)\b/i
    ],
    question: [
      /^(what|how|why|when|where|who|which)\b/i,
      /\?$/,
      /\b(explain|define|describe|tell me)\b/i
    ],
    instruction: [
      /^(create|make|build|generate|produce|develop)\b/i,
      /\b(step by step|instructions|guide|tutorial)\b/i,
      /\b(should|must|need to|required)\b/i
    ],
    research: [
      /\b(research|study|investigate|explore|find|search)\b/i,
      /\b(information|facts|evidence|sources|references)\b/i,
      /\b(latest|recent|current|updated)\b/i
    ],
    conversation: [
      /\b(hello|hi|hey|thanks|please|sorry)\b/i,
      /\b(chat|talk|discuss|conversation)\b/i,
      /\b(opinion|think|feel|believe)\b/i
    ]
  }

  static analyzePrompt(prompt: string): PromptAnalysis {
    const trimmedPrompt = prompt.trim()
    const wordCount = trimmedPrompt.split(/\s+/).length
    
    // Detect prompt type
    const type = this.detectPromptType(trimmedPrompt)
    
    // Calculate quality score
    const qualityScore = this.calculateQualityScore(trimmedPrompt)
    
    // Detect structural elements
    const hasContext = this.hasContext(trimmedPrompt)
    const hasConstraints = this.hasConstraints(trimmedPrompt)
    const hasExamples = this.hasExamples(trimmedPrompt)
    
    // Identify issues and suggestions
    const issues = this.identifyIssues(trimmedPrompt)
    const suggestions = this.generateSuggestions(trimmedPrompt, type, issues)

    return {
      type,
      confidence: this.calculateConfidence(trimmedPrompt, type),
      issues,
      suggestions,
      qualityScore,
      wordCount,
      hasContext,
      hasConstraints,
      hasExamples
    }
  }

  private static detectPromptType(prompt: string): PromptType {
    const scores: Record<PromptType, number> = {
      coding: 0,
      writing: 0,
      analysis: 0,
      creative: 0,
      question: 0,
      instruction: 0,
      conversation: 0,
      research: 0,
      general: 0
    }

    // Score each type based on pattern matches
    Object.entries(this.patterns).forEach(([type, patterns]) => {
      patterns.forEach((pattern: RegExp) => {
        if (pattern.test(prompt)) {
          scores[type as PromptType] += 1
        }
      })
    })

    // Find the highest scoring type
    const maxScore = Math.max(...Object.values(scores))
    if (maxScore === 0) return 'general'
    
    const detectedType = Object.entries(scores).find(([, score]) => score === maxScore)?.[0] as PromptType
    return detectedType || 'general'
  }

  private static calculateQualityScore(prompt: string): number {
    let score = 50 // Base score
    
    // Length scoring
    const wordCount = prompt.split(/\s+/).length
    if (wordCount >= 10) score += 15
    else if (wordCount >= 5) score += 10
    else if (wordCount < 3) score -= 20
    
    // Specificity indicators
    if (/\b(specific|exactly|precisely|detailed)\b/i.test(prompt)) score += 10
    if (/\b(format|structure|style|tone)\b/i.test(prompt)) score += 10
    if (/\b(example|instance|sample)\b/i.test(prompt)) score += 15
    
    // Context indicators
    if (/\b(context|background|situation|scenario)\b/i.test(prompt)) score += 10
    if (/\b(audience|target|intended for)\b/i.test(prompt)) score += 10
    
    // Constraint indicators
    if (/\b(must|should|need|require|limit|maximum|minimum)\b/i.test(prompt)) score += 10
    if (/\b(\d+\s*(word|character|line|step)s?)\b/i.test(prompt)) score += 15
    
    // Clarity deductions
    if (/\b(something|anything|stuff|thing)\b/i.test(prompt)) score -= 15
    if (prompt.length < 10) score -= 20
    if (!/[.!?]$/.test(prompt.trim())) score -= 5
    
    return Math.max(0, Math.min(100, score))
  }

  private static calculateConfidence(prompt: string, type: PromptType): number {
    if (type === 'general') return 0.3
    
    const patterns = this.patterns[type] || []
    const matches = patterns.filter(pattern => pattern.test(prompt)).length
    
    return Math.min(0.95, 0.4 + (matches * 0.15))
  }

  private static hasContext(prompt: string): boolean {
    return /\b(context|background|situation|scenario|given|assuming|consider)\b/i.test(prompt)
  }

  private static hasConstraints(prompt: string): boolean {
    return /\b(must|should|need|require|limit|maximum|minimum|within|under|no more than)\b/i.test(prompt) ||
           /\b(\d+\s*(word|character|line|step)s?)\b/i.test(prompt)
  }

  private static hasExamples(prompt: string): boolean {
    return /\b(example|instance|sample|such as|like|including|for instance)\b/i.test(prompt)
  }

  private static identifyIssues(prompt: string): string[] {
    const issues: string[] = []
    
    if (prompt.length < 20) {
      issues.push('Prompt is too short and may be unclear')
    }
    
    if (/\b(something|anything|stuff|thing)\b/i.test(prompt)) {
      issues.push('Contains vague terms that should be more specific')
    }
    
    if (!/[.!?]$/.test(prompt.trim())) {
      issues.push('Missing proper punctuation')
    }
    
    if (!this.hasContext(prompt) && prompt.split(/\s+/).length > 3) {
      issues.push('Could benefit from additional context')
    }
    
    if (!this.hasConstraints(prompt)) {
      issues.push('Missing specific requirements or constraints')
    }
    
    if (prompt.split(/\s+/).length > 100) {
      issues.push('May be too long and complex')
    }
    
    return issues
  }

  private static generateSuggestions(prompt: string, type: PromptType, issues: string[]): string[] {
    const suggestions: string[] = []
    
    if (issues.includes('Prompt is too short and may be unclear')) {
      suggestions.push('Add more specific details about what you want')
      suggestions.push('Include context or background information')
    }
    
    if (issues.includes('Contains vague terms that should be more specific')) {
      suggestions.push('Replace vague terms with specific requirements')
    }
    
    if (issues.includes('Could benefit from additional context')) {
      suggestions.push('Add context about the intended use or audience')
    }
    
    if (issues.includes('Missing specific requirements or constraints')) {
      suggestions.push('Specify format, length, or style requirements')
      suggestions.push('Add constraints or limitations')
    }
    
    // Type-specific suggestions
    if (type === 'coding') {
      if (!/\b(language|framework)\b/i.test(prompt)) {
        suggestions.push('Specify the programming language or framework')
      }
      if (!/\b(comment|document)\b/i.test(prompt)) {
        suggestions.push('Request code comments or documentation')
      }
    }
    
    if (type === 'writing') {
      if (!/\b(tone|style|audience)\b/i.test(prompt)) {
        suggestions.push('Specify the tone, style, or target audience')
      }
      if (!/\b(\d+\s*words?)\b/i.test(prompt)) {
        suggestions.push('Include desired word count or length')
      }
    }
    
    return suggestions
  }
}