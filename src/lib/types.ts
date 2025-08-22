export interface FileAttachment {
  id: string
  name: string
  type: string
  size: number
  data: string // base64 encoded data
  url?: string // for display purposes
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  provider?: string
  model?: string
  tokens?: number
  cost?: number
  activeModels?: string[] // Track which models were active when user message was sent
  attachments?: FileAttachment[] // File attachments for multimodal support
}

export interface Model {
  id: string
  name: string
  provider: string
  contextLength: number
  inputCost?: number // per 1K tokens
  outputCost?: number // per 1K tokens
  supportsFiles?: boolean // Whether this model supports file uploads
  supportedFileTypes?: string[] // MIME types or extensions supported
}

export interface ChatRequest {
  messages: Message[]
  model: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatResponse {
  id: string
  content: string
  model: string
  provider: string
  tokens?: {
    input: number
    output: number
    total: number
  }
  cost?: number
  finishReason?: string
}

export interface StreamChunk {
  id: string
  content: string
  done: boolean
  tokens?: number
}

export interface ProviderConfig {
  name: string
  apiKey: string
  baseUrl?: string
  models: Model[]
  enabled: boolean
}

export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'openrouter'

export interface LLMProvider {
  name: ProviderName
  models: Model[]
  validateAPIKey(apiKey: string): Promise<boolean>
  complete(request: ChatRequest, apiKey: string): Promise<ChatResponse>
  stream(request: ChatRequest, apiKey: string): AsyncGenerator<StreamChunk>
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  activeProviders: ProviderName[]
  createdAt: number
  updatedAt: number
}