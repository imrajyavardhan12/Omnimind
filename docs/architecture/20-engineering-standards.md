# 20 — Engineering Standards

## Purpose

This document defines coding and engineering standards for the OmniMind v2 rebuild.

The goal is to keep the codebase maintainable as multiple agents or engineers work on it over time.

## General Standards

- Use TypeScript everywhere.
- Prefer explicit types at public boundaries.
- Use Zod for runtime validation.
- Keep modules small and cohesive.
- Prefer domain-specific services over generic utility dumping grounds.
- Keep business logic out of React components.
- Keep provider-specific behavior inside the LLM Gateway.

## Naming

Use clear domain names:

```txt
ChatRun
ChatModelRun
Conversation
ProviderKey
ModelCatalogEntry
UsageLedgerEntry
CouncilRun
```

Avoid vague names:

```txt
data
item
thing
responseObj
handler2
```

## TypeScript

Recommended:

```ts
export type ProviderName = 'openai' | 'anthropic' | 'google' | 'openrouter'
```

Avoid broad `string` for known domains.

Avoid `any`. If unavoidable, isolate and document it.

Use `unknown` for untrusted external payloads before validation.

## Validation

All external inputs must be validated.

Validate:

- API request bodies.
- Query parameters.
- Route params.
- Webhook payloads.
- Provider responses where practical.
- Environment variables.

Use shared schemas from `packages/types` where possible.

## Error Handling

Use stable error codes.

Example:

```txt
PROVIDER_KEY_MISSING
PROVIDER_RATE_LIMITED
MODEL_CAPABILITY_UNSUPPORTED
CONTEXT_TOO_LARGE
BUDGET_EXCEEDED
```

Do not expose raw provider errors directly to users.

Every public error response should include:

```txt
code
message
requestId
```

## Backend Layering

Recommended route flow:

```txt
route → validation → service → repository/gateway → response
```

Avoid:

```txt
route → huge inline business logic → raw database calls → provider call
```

## Database Access

Use repository modules for repeated database operations.

Use transactions for atomic operations.

Do not keep transactions open while waiting for provider responses.

## Frontend Standards

React components should focus on rendering and user interaction.

Use feature API clients for HTTP requests.

Use TanStack Query for server state.

Use Zustand/component state for local UI state only.

Avoid raw `fetch` calls scattered throughout components.

## Streaming Standards

All stream event shapes must be documented in `09-streaming-protocol.md`.

Every event should include:

```txt
type
runId
sequence
timestamp
data
```

## Provider Standards

Provider logic belongs in the LLM Gateway.

Each provider adapter should normalize:

- request format
- streaming deltas
- usage
- errors
- cancellation behavior

## Cost Standards

Cost calculation should use model catalog pricing.

Do not hardcode pricing in UI components or random provider files.

Costs should use decimal-safe handling where important.

## Logging Standards

Use structured logs.

Include:

```txt
requestId
userId
workspaceId
runId
modelRunId
provider
model
```

Never log:

- provider keys
- auth cookies
- access tokens
- raw large file payloads

## Documentation Standards

Update docs when changing:

- architecture
- API contracts
- stream events
- data schema
- security behavior
- provider behavior
- infrastructure

Use ADRs for significant decisions.

## Code Review Standards

A change is not ready if:

- It violates documented architecture.
- It introduces hidden provider calls in UI.
- It persists canonical data only in localStorage.
- It stores secrets in browser state.
- It has no validation at external boundaries.
- It changes schema without migration/docs.

## Commit/PR Guidance

Keep changes coherent.

Good PR/task examples:

- Add API health service skeleton.
- Add provider key metadata table and repository.
- Add LLM Gateway normalized event types.

Bad PR/task examples:

- Rewrite the entire app.
- Add database, UI redesign, and provider changes together.
- Migrate all chat behavior without tests or stream docs.
