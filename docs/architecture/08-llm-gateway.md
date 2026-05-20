# 08 — LLM Gateway Architecture

## Purpose

The LLM Gateway is the internal abstraction that isolates OmniMind from provider-specific APIs.

The rest of the application should not know how OpenAI, Anthropic, Gemini, or OpenRouter structure requests, stream responses, report errors, or count tokens.

## Implementation

Use the Vercel AI SDK inside the gateway, with targeted custom adapters only for provider/model edge cases that the SDK does not cover cleanly.

```txt
Chat Orchestrator
  → LLM Gateway
      → Vercel AI SDK provider adapters
      → targeted custom adapters for edge cases
```

## Responsibilities

The LLM Gateway owns:

- Provider selection.
- Request normalization.
- Message conversion.
- Attachment conversion.
- Streaming event normalization.
- Usage normalization.
- Error normalization.
- Retryable failure detection.
- Provider health checks.
- Model capability checks.
- Fallback routing.

## Public Internal Interface

Example TypeScript interface:

```ts
export interface LLMGateway {
  streamText(request: LLMRequest): AsyncIterable<LLMStreamEvent>
  generateText(request: LLMRequest): Promise<LLMResponse>
  validateProviderKey(input: ValidateProviderKeyInput): Promise<ValidateProviderKeyResult>
  listModels(input: ListModelsInput): Promise<ModelDescriptor[]>
}
```

## Normalized Request

```ts
export interface LLMRequest {
  provider: ProviderName
  model: string
  messages: NormalizedMessage[]
  temperature?: number
  maxOutputTokens?: number
  responseFormat?: ResponseFormat
  tools?: ToolDefinition[]
  attachments?: NormalizedAttachment[]
  providerKey: string
  metadata: {
    userId: string
    workspaceId: string
    runId: string
    modelRunId: string
  }
}
```

## Normalized Stream Events

```ts
export type LLMStreamEvent =
  | { type: 'start'; providerRequestId?: string }
  | { type: 'delta'; text: string }
  | { type: 'tool_call'; toolCall: NormalizedToolCall }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'finish'; finishReason: string; usage?: TokenUsage }
  | { type: 'error'; error: NormalizedLLMError }
```

## Normalized Response

```ts
export interface LLMResponse {
  text: string
  providerRequestId?: string
  finishReason?: string
  usage?: TokenUsage
  raw?: unknown
}
```

## Provider Capability Checks

Before invoking a provider, the gateway should validate:

- Model exists.
- Model is enabled.
- Model supports streaming if streaming requested.
- Model supports vision if image attachments exist.
- Model supports tools if tools are requested.
- Requested output tokens are within limits.
- Context length is not exceeded.

## Retry Strategy

Retries should be centralized in the gateway.

Retryable:

- 408 timeout.
- 429 rate limit with backoff.
- 500/502/503/504 provider errors.
- network interruption before output starts.

Usually non-retryable:

- invalid API key.
- model not found.
- unsupported modality.
- content filtered.
- context too large.
- malformed request.

## Circuit Breaker

The gateway should maintain provider/model health state in Redis.

Example:

```txt
provider:openai:model:gpt-4o unhealthy for 60s after repeated 5xx
```

This prevents repeatedly hammering a failing provider.

## Fallbacks

Fallbacks should be explicit and configurable.

Example:

```txt
primary: openai/gpt-4o
fallbacks:
  - openai/gpt-4o-mini
  - anthropic/claude-sonnet
```

Fallback should not silently change a user-selected model in compare mode unless product UX explicitly communicates it.

## Usage Normalization

Different providers report tokens differently.

The gateway should return normalized usage:

```ts
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  reasoningTokens?: number
  cachedInputTokens?: number
}
```

If provider usage is missing, estimate and mark usage as estimated:

```ts
usageSource: 'provider' | 'estimated'
```

## Cost Calculation

Cost calculation should use the model registry pricing metadata.

Never hardcode pricing only inside provider classes.

## LiteLLM

LiteLLM is not part of the v2 core stack.

OmniMind v2 will use its own LLM Gateway contract with Vercel AI SDK and targeted custom adapters behind it.

Do not introduce LiteLLM during the v2 rebuild unless a future ADR supersedes the platform stack decision.

## Provider-Specific Edge Cases

The gateway should contain explicit handling for:

- OpenAI reasoning models that do not support normal streaming/temperature behavior.
- Anthropic system message formatting.
- Gemini content/role conversion.
- OpenRouter models with inconsistent streaming support.
- Vision attachment formats.
- Tool call differences.

## Testing Strategy

Implement gateway tests with mocked provider streams.

Test:

- SSE parsing.
- Provider errors.
- Partial streams.
- Usage normalization.
- Attachment conversion.
- Model capability validation.
- Cancellation.
