# 02 — Architecture Principles

## 1. Backend Owns Orchestration

Frontend components should not fan out directly to multiple providers.

The frontend should create a chat run and subscribe to events. The backend should manage provider calls, retries, cancellation, persistence, usage accounting, and model-specific behavior.

## 2. One User Action Equals One Run

Every prompt submission should create a durable `chat_run`.

If the user sends one message to five models, this is:

- One `chat_run`.
- Five `chat_model_runs`.
- Many stream events.

This makes debugging, billing, cancellation, export, and replay straightforward.

## 3. Providers Are Implementation Details

The UI should never know provider-specific streaming formats.

All provider differences should be normalized by an internal LLM Gateway.

## 4. Store Canonical Data Server-Side

LocalStorage is acceptable for drafts, ephemeral preferences, and UI state, but not as the canonical conversation store.

Canonical state belongs in Postgres.

## 5. Secure BYOK by Default

User provider keys should be encrypted and stored server-side. The browser should not persist long-lived provider secrets.

A local-only provider key mode is not part of the v2 rebuild. The v2 production model is server-side encrypted provider keys.

## 6. Design for Partial Failure

Multi-model systems fail partially all the time.

The product should allow:

- One model to fail while others succeed.
- One provider to be degraded while others continue.
- Retries for transient failures.
- Clear user-visible errors per model.
- Run-level completion even with failed model runs.

## 7. Observability Is a Product Feature

For an AI product, traces, usage, prompt versions, latency, model errors, and token/cost accounting are core infrastructure.

Observability should be implemented from the beginning, not bolted on later.

## 8. Avoid Premature Platform Complexity

Use the managed infrastructure defined in ADR 0006:

- Vercel for web.
- Render for API and background workers.
- Neon Postgres.
- Upstash Redis.
- Cloudflare R2.
- Infisical for secrets.
- Inngest for workflows.
- Cloudflare for edge/WAF/DNS.

Avoid Kubernetes and AWS-native infrastructure during the v2 rebuild.

## 9. Type Contracts Across Boundaries

Use shared TypeScript types and Zod schemas for API contracts.

The UI, API, workers, and AI gateway should agree on event and data contracts.

## 10. Capabilities, Not Assumptions

Models should be selected and invoked based on capability metadata:

- Streaming support.
- Vision support.
- Tool support.
- JSON support.
- Max context.
- Max output tokens.
- Input/output pricing.
- Provider-specific constraints.

Do not assume all models support the same request shape.

## 11. Every Cost Should Be Accounted For

Every provider call should write usage and cost data to a ledger.

This allows dashboards, budgets, quotas, billing, and abuse detection.

## 12. Workflows Should Be Durable

Long-running or multi-stage flows should not depend on a browser session.

Council mode, file extraction, transcription, indexing, exports, and batch evaluations should run as background workflows.
