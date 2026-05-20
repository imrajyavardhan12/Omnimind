import { PromptAnalyzer } from './analyzer'
import { PromptTemplates } from './templates'
import { 
  PromptEnhancementRequest, 
  PromptEnhancementResponse, 
  EnhancedPrompt, 
  EnhancementType 
} from './types'

export class PromptEnhancer {
  static enhance(request: PromptEnhancementRequest): PromptEnhancementResponse {
    const { originalPrompt, targetProviders = [], preferredTypes = [] } = request
    
    // Analyze the original prompt
    const analysis = PromptAnalyzer.analyzePrompt(originalPrompt)
    
    // Generate enhancements
    const enhancements: EnhancedPrompt[] = []
    
    // Get templates for the detected prompt type
    const templates = PromptTemplates.getTemplatesForType(analysis.type)
    
    // Generate standard enhancements
    const standardTypes: EnhancementType[] = preferredTypes.length > 0 
      ? preferredTypes 
      : ['detailed', 'focused', 'structured']
    
    standardTypes.forEach(type => {
      const template = templates.find(t => t.type === type) || templates[0]
      if (template) {
        const enhanced = this.generateFromTemplate(template, originalPrompt, analysis)
        enhancements.push(enhanced)
      }
    })
    
    // Generate provider-optimized versions
    if (targetProviders.length > 0) {
      targetProviders.forEach(provider => {
        const optimizedContent = PromptTemplates.getProviderOptimizedTemplate(provider, originalPrompt)
        enhancements.push({
          id: `provider-${provider}-${Date.now()}`,
          type: 'provider-optimized',
          title: `Optimized for ${provider}`,
          description: `Tailored specifically for ${provider} model characteristics`,
          content: optimizedContent,
          provider,
          qualityScore: Math.min(100, analysis.qualityScore + 15),
          improvements: [
            `Optimized for ${provider} model behavior`,
            'Enhanced prompt structure for better results',
            'Provider-specific formatting applied'
          ]
        })
      })
    }
    
    // If no enhancements generated, create a basic enhanced version
    if (enhancements.length === 0) {
      enhancements.push(this.createBasicEnhancement(originalPrompt, analysis))
    }
    
    return {
      analysis,
      enhancements: enhancements.slice(0, 4), // Limit to 4 enhancements
      originalPrompt
    }
  }

  private static generateFromTemplate(
    template: any, 
    originalPrompt: string, 
    analysis: any
  ): EnhancedPrompt {
    let content = template.pattern
    
    // Replace placeholders
    const placeholders: Record<string, string> = {
      originalPrompt,
      language: this.inferLanguage(originalPrompt),
      audience: this.inferAudience(originalPrompt),
      tone: this.inferTone(originalPrompt),
      style: this.inferStyle(originalPrompt),
      length: this.inferLength(originalPrompt),
      format: this.inferFormat(originalPrompt),
      mood: this.inferMood(originalPrompt),
      themes: this.inferThemes(originalPrompt),
      inspiration: 'contemporary examples and established best practices'
    }
    
    // Replace all placeholders in the template
    Object.entries(placeholders).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
    })
    
    // Calculate improvement score
    const improvements = this.identifyImprovements(originalPrompt, content, analysis)
    
    return {
      id: `${template.type}-${Date.now()}`,
      type: template.type,
      title: template.title,
      description: template.description,
      content,
      qualityScore: Math.min(100, analysis.qualityScore + 20),
      improvements
    }
  }

  private static createBasicEnhancement(originalPrompt: string, analysis: any): EnhancedPrompt {
    let enhanced = originalPrompt
    
    // Add context if missing
    if (!analysis.hasContext && analysis.type !== 'question') {
      enhanced = `Context: Please help with the following request.\n\n${enhanced}`
    }
    
    // Add structure based on type
    if (analysis.type === 'coding') {
      enhanced += `\n\nPlease include:\n- Clean, commented code\n- Brief explanation of approach\n- Example usage`
    } else if (analysis.type === 'writing') {
      enhanced += `\n\nPlease ensure the content is:\n- Well-structured and organized\n- Appropriate for the intended audience\n- Engaging and informative`
    } else if (analysis.type === 'analysis') {
      enhanced += `\n\nPlease provide:\n- Clear analysis with supporting reasoning\n- Balanced perspective considering multiple viewpoints\n- Actionable insights or conclusions`
    } else {
      enhanced += `\n\nPlease provide a comprehensive and well-structured response.`
    }
    
    return {
      id: `basic-${Date.now()}`,
      type: 'detailed',
      title: 'Enhanced Version',
      description: 'Improved version with better structure and clarity',
      content: enhanced,
      qualityScore: Math.min(100, analysis.qualityScore + 15),
      improvements: [
        'Added clearer structure',
        'Enhanced specificity',
        'Improved clarity and completeness'
      ]
    }
  }

  private static identifyImprovements(
    original: string, 
    enhanced: string, 
    analysis: any
  ): string[] {
    const improvements: string[] = []
    
    if (enhanced.length > original.length * 1.5) {
      improvements.push('Added comprehensive context and structure')
    }
    
    if (/requirements?:|please (include|provide|ensure)/i.test(enhanced)) {
      improvements.push('Added specific requirements and guidelines')
    }
    
    if (/step|framework|structure/i.test(enhanced)) {
      improvements.push('Included structured approach')
    }
    
    if (analysis.qualityScore < 60) {
      improvements.push('Significantly improved clarity and specificity')
    }
    
    if (!analysis.hasExamples && /example|instance/i.test(enhanced)) {
      improvements.push('Added request for examples and illustrations')
    }
    
    if (!analysis.hasConstraints && /format|length|style/i.test(enhanced)) {
      improvements.push('Included format and constraint specifications')
    }
    
    return improvements.length > 0 ? improvements : ['Enhanced overall quality and clarity']
  }

  // Helper methods to infer context from prompts
  private static inferLanguage(prompt: string): string {
    const languages = {
      javascript: /javascript|js|node|react|vue/i,
      python: /python|py|django|flask/i,
      typescript: /typescript|ts/i,
      java: /java(?!script)/i,
      csharp: /c#|csharp|\.net/i,
      go: /\bgo\b|golang/i,
      rust: /rust/i,
      php: /php/i,
      ruby: /ruby|rails/i,
      cpp: /c\+\+|cpp/i
    }
    
    for (const [lang, pattern] of Object.entries(languages)) {
      if (pattern.test(prompt)) {
        return lang === 'csharp' ? 'C#' : lang === 'cpp' ? 'C++' : lang.charAt(0).toUpperCase() + lang.slice(1)
      }
    }
    
    return 'your preferred programming language'
  }

  private static inferAudience(prompt: string): string {
    if (/beginner|novice|new|learning/i.test(prompt)) return 'beginners'
    if (/advanced|expert|professional/i.test(prompt)) return 'advanced practitioners'
    if (/student|academic/i.test(prompt)) return 'students'
    if (/business|corporate|enterprise/i.test(prompt)) return 'business professionals'
    return 'general audience'
  }

  private static inferTone(prompt: string): string {
    if (/formal|professional|business/i.test(prompt)) return 'formal and professional'
    if (/casual|friendly|conversational/i.test(prompt)) return 'casual and approachable'
    if (/technical|detailed|precise/i.test(prompt)) return 'technical and informative'
    return 'clear and engaging'
  }

  private static inferStyle(prompt: string): string {
    if (/academic|research|scholarly/i.test(prompt)) return 'academic'
    if (/blog|article|content/i.test(prompt)) return 'blog/article style'
    if (/tutorial|guide|how-to/i.test(prompt)) return 'instructional'
    if (/creative|story|narrative/i.test(prompt)) return 'creative writing'
    return 'clear and informative'
  }

  private static inferLength(prompt: string): string {
    const lengthMatch = prompt.match(/(\d+)\s*(word|character|page)s?/i)
    if (lengthMatch) return `${lengthMatch[1]} ${lengthMatch[2]}s`
    
    if (/brief|short|concise/i.test(prompt)) return '200-300 words'
    if (/detailed|comprehensive|thorough/i.test(prompt)) return '500-800 words'
    if (/long|extensive|in-depth/i.test(prompt)) return '800+ words'
    return 'appropriate length for the topic'
  }

  private static inferFormat(prompt: string): string {
    if (/list|bullet/i.test(prompt)) return 'bulleted list'
    if (/essay|article/i.test(prompt)) return 'essay format'
    if (/step|guide|tutorial/i.test(prompt)) return 'step-by-step guide'
    if (/report|analysis/i.test(prompt)) return 'structured report'
    return 'well-organized prose'
  }

  private static inferMood(prompt: string): string {
    if (/serious|formal|professional/i.test(prompt)) return 'serious and professional'
    if (/fun|playful|entertaining/i.test(prompt)) return 'engaging and entertaining'
    if (/inspiring|motivational/i.test(prompt)) return 'inspiring and uplifting'
    return 'appropriate and engaging'
  }

  private static inferThemes(prompt: string): string {
    if (/innovation|future|technology/i.test(prompt)) return 'innovation and progress'
    if (/learning|education|growth/i.test(prompt)) return 'learning and development'
    if (/business|success|achievement/i.test(prompt)) return 'success and achievement'
    return 'relevant and meaningful themes'
  }
}