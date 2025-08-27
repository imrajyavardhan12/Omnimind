import { PromptType, EnhancementType } from './types'

export interface PromptTemplate {
  type: EnhancementType
  title: string
  description: string
  pattern: string
  placeholders: string[]
}

export class PromptTemplates {
  private static readonly templates: Record<PromptType, PromptTemplate[]> = {
    coding: [
      {
        type: 'detailed',
        title: 'Comprehensive Technical',
        description: 'Detailed technical requirements with best practices',
        pattern: `You are an expert {{language}} developer. {{originalPrompt}}

Requirements:
- Write clean, well-commented code following best practices
- Include error handling for edge cases
- Provide time/space complexity analysis
- Add example usage with test cases
- Explain the algorithm/approach used

Please format your response with:
1. Code implementation
2. Explanation of approach
3. Complexity analysis
4. Example usage
5. Edge cases handled`,
        placeholders: ['language', 'originalPrompt']
      },
      {
        type: 'focused',
        title: 'Quick & Clean',
        description: 'Concise but complete code solution',
        pattern: `{{originalPrompt}}

Please provide:
- Clean, readable code with comments
- Brief explanation of the approach
- One example of usage

Keep it concise but complete.`,
        placeholders: ['originalPrompt']
      },
      {
        type: 'structured',
        title: 'Step-by-Step Implementation',
        description: 'Structured approach with clear steps',
        pattern: `Break down this coding task: {{originalPrompt}}

Please provide:

**Step 1: Analysis**
- Problem understanding
- Input/output requirements
- Constraints and edge cases

**Step 2: Design**  
- Algorithm approach
- Data structures needed
- Time/space complexity

**Step 3: Implementation**
- Complete code solution
- Inline comments explaining logic

**Step 4: Testing**
- Example test cases
- Edge case validation`,
        placeholders: ['originalPrompt']
      }
    ],
    
    writing: [
      {
        type: 'detailed',
        title: 'Comprehensive Writing Brief',
        description: 'Detailed writing requirements with style guidelines',
        pattern: `You are a professional writer. {{originalPrompt}}

Writing Requirements:
- Target audience: {{audience}}
- Tone: {{tone}}
- Style: {{style}}
- Length: {{length}}
- Format: {{format}}

Structure your response with:
1. Clear introduction
2. Well-organized body with logical flow  
3. Compelling conclusion
4. Proper transitions between sections

Please ensure the content is engaging, well-researched, and tailored to the specified audience.`,
        placeholders: ['originalPrompt', 'audience', 'tone', 'style', 'length', 'format']
      },
      {
        type: 'focused',
        title: 'Clear & Concise',
        description: 'Focused writing with clear objectives',
        pattern: `{{originalPrompt}}

Please write content that is:
- Clear and easy to understand
- Well-structured with logical flow
- Engaging for the reader
- Appropriate length for the topic

Focus on delivering value while maintaining readability.`,
        placeholders: ['originalPrompt']
      }
    ],
    
    analysis: [
      {
        type: 'detailed',
        title: 'Comprehensive Analysis',
        description: 'Thorough analytical framework',
        pattern: `Conduct a comprehensive analysis: {{originalPrompt}}

Analysis Framework:
1. **Overview**: Context and background
2. **Key Factors**: Main elements to analyze
3. **Detailed Examination**: 
   - Strengths and advantages
   - Weaknesses and limitations
   - Opportunities and potential
   - Threats and risks
4. **Comparative Analysis**: How it compares to alternatives
5. **Implications**: What this means for stakeholders
6. **Conclusions**: Key insights and recommendations

Please support your analysis with logical reasoning and evidence where applicable.`,
        placeholders: ['originalPrompt']
      },
      {
        type: 'structured',
        title: 'Pros & Cons Analysis',
        description: 'Balanced evaluation format',
        pattern: `Analyze: {{originalPrompt}}

**Positive Aspects:**
- [List advantages, benefits, strengths]

**Negative Aspects:**  
- [List disadvantages, limitations, concerns]

**Neutral Observations:**
- [Objective facts and considerations]

**Overall Assessment:**
- Summary of key insights
- Balanced conclusion
- Recommendations if applicable`,
        placeholders: ['originalPrompt']
      }
    ],
    
    creative: [
      {
        type: 'detailed',
        title: 'Rich Creative Brief',
        description: 'Detailed creative direction with inspiration',
        pattern: `Creative Brief: {{originalPrompt}}

Creative Parameters:
- Style/Genre: {{style}}
- Mood/Tone: {{mood}}
- Target Audience: {{audience}}
- Key Themes: {{themes}}
- Inspiration Sources: {{inspiration}}

Creative Requirements:
- Be original and imaginative
- Develop rich, vivid descriptions
- Create engaging characters/concepts
- Include sensory details
- Build emotional connection
- Ensure coherent narrative flow

Let your creativity shine while maintaining focus on the core request.`,
        placeholders: ['originalPrompt', 'style', 'mood', 'audience', 'themes', 'inspiration']
      }
    ],
    
    question: [
      {
        type: 'detailed',
        title: 'Comprehensive Explanation',
        description: 'Thorough educational response',
        pattern: `Question: {{originalPrompt}}

Please provide a comprehensive explanation that includes:

**Direct Answer**: Clear, concise response to the question

**Detailed Explanation**: 
- Background context and relevance
- Key concepts and definitions
- Step-by-step breakdown if applicable
- Important nuances or considerations

**Examples**: Practical examples or analogies to illustrate the concept

**Related Information**: Connected topics or follow-up considerations

**Summary**: Key takeaways in simple terms

Aim to educate while being accessible to the intended audience.`,
        placeholders: ['originalPrompt']
      }
    ],
    
    instruction: [
      {
        type: 'structured',
        title: 'Step-by-Step Guide',
        description: 'Clear instructional format',
        pattern: `Create a guide: {{originalPrompt}}

**Overview**: What this guide will help you accomplish

**Prerequisites**: What you need before starting
- Required tools/materials
- Necessary knowledge/skills
- Time estimate

**Step-by-Step Instructions**:
1. [First step with clear action]
2. [Second step with specific details]
3. [Continue with logical progression]

**Tips & Best Practices**:
- Important considerations
- Common mistakes to avoid
- Optimization suggestions

**Troubleshooting**: Common issues and solutions

**Conclusion**: Summary and next steps`,
        placeholders: ['originalPrompt']
      }
    ],
    
    research: [
      {
        type: 'detailed',
        title: 'Research Framework',
        description: 'Structured research approach',
        pattern: `Research Topic: {{originalPrompt}}

**Research Scope**: Define what aspects to investigate

**Key Questions to Address**:
- Primary research questions
- Secondary considerations
- Specific areas of focus

**Information Sources**:
- Types of sources to consult
- Credibility criteria
- Diversity of perspectives

**Analysis Framework**:
- How to evaluate findings
- Comparison methods
- Validation approaches

**Expected Deliverables**:
- Summary of findings
- Key insights and conclusions
- Implications and recommendations
- Areas for further investigation`,
        placeholders: ['originalPrompt']
      }
    ],
    
    conversation: [
      {
        type: 'contextual',
        title: 'Conversational Context',
        description: 'Natural conversation with context',
        pattern: `Context: {{originalPrompt}}

Please engage in a natural, helpful conversation while:
- Being conversational and approachable
- Asking clarifying questions when helpful
- Providing thoughtful, relevant responses
- Maintaining the conversation flow
- Offering follow-up suggestions when appropriate

Focus on being genuinely helpful while keeping the interaction engaging.`,
        placeholders: ['originalPrompt']
      }
    ],
    
    general: [
      {
        type: 'detailed',
        title: 'Comprehensive Response',
        description: 'Thorough treatment of the topic',
        pattern: `Request: {{originalPrompt}}

Please provide a comprehensive response that:
- Addresses all aspects of the request
- Includes relevant context and background
- Offers specific, actionable information
- Considers different perspectives when applicable
- Provides clear structure and organization
- Includes examples or illustrations where helpful

Ensure your response is thorough, accurate, and genuinely useful.`,
        placeholders: ['originalPrompt']
      },
      {
        type: 'focused',
        title: 'Direct & Clear',
        description: 'Straightforward, focused response',
        pattern: `{{originalPrompt}}

Please provide a clear, direct response that:
- Gets straight to the point
- Focuses on the most important information
- Uses simple, accessible language
- Includes practical examples if relevant

Keep it concise while ensuring completeness.`,
        placeholders: ['originalPrompt']
      }
    ]
  }

  static getTemplatesForType(type: PromptType): PromptTemplate[] {
    return this.templates[type] || this.templates.general
  }

  static getAllTemplates(): Record<PromptType, PromptTemplate[]> {
    return this.templates
  }

  static getProviderOptimizedTemplate(provider: string, originalPrompt: string): string {
    const optimizations: Record<string, string> = {
      openai: `${originalPrompt}

Please provide a detailed, well-structured response with clear explanations and examples where appropriate.`,
      
      anthropic: `Here's my request: ${originalPrompt}

I'd appreciate a thorough response that demonstrates clear reasoning and includes practical examples. Please be comprehensive while maintaining clarity.`,
      
      gemini: `${originalPrompt}

Please provide a comprehensive response with:
- Clear structure and organization
- Relevant examples and explanations
- Step-by-step breakdown if applicable
- Practical insights and recommendations`,
      
      openrouter: `${originalPrompt}

Please ensure your response is:
- Well-organized and easy to follow
- Includes specific details and examples
- Provides actionable information
- Is appropriate for the complexity of the request`
    }

    return optimizations[provider] || originalPrompt
  }
}