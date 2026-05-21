import type { ModelMessage } from 'ai'
import type {
  GatewayError,
  GatewayMessage,
  GatewayStreamChunk,
  NormalizedUsage,
} from '@omnimind/types'

export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'google-ai-studio'

/**
 * Runtime request shape for the LLMGateway.
 *
 * `providerKey` is the **decrypted plaintext** provider API key. The caller
 * (apps/api route handler) is responsible for fetching the encrypted row via
 * ProviderKeyRepository and decrypting it via the M2 vault helper before
 * invoking the gateway. The gateway never touches the database for keys and
 * never reads PROVIDER_API_KEY env vars directly.
 *
 * `abortSignal` is threaded directly into the underlying Vercel AI SDK call
 * so cancellation propagates to the provider connection.
 */
export interface LLMGatewayRequest {
  provider: ProviderName
  model: string
  messages: GatewayMessage[]
  system?: string
  temperature?: number
  maxOutputTokens?: number
  /** Plaintext provider API key, decrypted by the caller from the M2 vault. */
  providerKey: string
  abortSignal?: AbortSignal
}

export type AdapterModelMessage = ModelMessage

export type { GatewayError, GatewayMessage, GatewayStreamChunk, NormalizedUsage }
