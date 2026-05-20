# ADR 0002 — Use Vercel AI SDK Behind an Internal LLM Gateway

## Status

Accepted

## Context

OmniMind supports multiple LLM providers. Each provider has different APIs, streaming formats, error shapes, model capabilities, pricing, and multimodal support.

The current custom provider classes provide control but require ongoing maintenance.

## Decision

Use the Vercel AI SDK as the primary provider invocation SDK, but only behind an internal OmniMind LLM Gateway abstraction.

The application should depend on OmniMind's gateway interface, not directly on Vercel AI SDK calls scattered throughout the codebase.

## Consequences

### Positive

- Faster provider integration.
- Better streaming abstractions.
- Tool calling and structured output support.
- Less manual SSE parsing.
- Still keeps provider layer replaceable.

### Negative

- Some provider-specific features may need custom adapters.
- Gateway must handle SDK limitations and edge cases.
- Additional abstraction to maintain.

## Alternatives Considered

### Fully custom provider adapters

Rejected as the default because it increases maintenance burden.

### LiteLLM only

Rejected as the only abstraction because OmniMind should own its product-level gateway contract.

### LangChain as core chat layer

Rejected for core streaming chat. It may be useful later for RAG/agent workflows, but is heavier than needed for the primary chat execution path.
