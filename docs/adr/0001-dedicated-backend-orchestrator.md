# ADR 0001 — Use a Dedicated Backend Orchestration Layer

## Status

Accepted

## Context

The current MVP lets frontend components and Next.js route handlers coordinate model calls. This works for a prototype but becomes difficult as the app adds:

- Multi-model fan-out.
- Streaming from multiple providers.
- Cancellation.
- Retries.
- Cost accounting.
- Persistent conversations.
- Council workflows.
- Observability.

If orchestration remains in frontend components, the app will become hard to debug, hard to secure, and hard to scale.

## Decision

OmniMind v2 will use a dedicated backend orchestration layer.

The frontend will create chat runs and subscribe to stream events. The backend will own provider calls, run state, usage accounting, retries, cancellation, and persistence.

## Consequences

### Positive

- Centralized business logic.
- Secure provider key handling.
- Consistent streaming behavior.
- Better observability.
- Easier cost tracking.
- Easier partial failure handling.
- Future workflows become simpler.

### Negative

- More backend infrastructure.
- More initial implementation work.
- Requires API deployment in addition to web deployment.

## Alternatives Considered

### Keep all logic in Next.js API routes

Rejected for long-term architecture. Acceptable for MVP, but not ideal for durable orchestration and background workflows.

### Put all logic in frontend

Rejected for security and reliability.

### Use a third-party LLM proxy only

Rejected as the only orchestration layer. A proxy can help invoke providers, but OmniMind still needs product-specific run state, persistence, cost accounting, and workflow logic.
