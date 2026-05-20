# 03 — Target System Architecture

## Overview

OmniMind v2 should be structured as a modular platform with a Next.js frontend, a dedicated API/BFF layer, an AI orchestration layer, background workers, and a durable data layer.

## High-Level Diagram

```txt
                                  ┌───────────────────────┐
                                  │      Cloudflare        │
                                  │ CDN, WAF, rate limits  │
                                  └───────────┬───────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         │                                         │
                         ▼                                         ▼
              ┌──────────────────────┐                  ┌──────────────────────┐
              │     Next.js Web       │                  │   API Gateway / BFF   │
              │ UI, SSR, auth screens │                  │ auth, quotas, streams │
              └───────────┬──────────┘                  └───────────┬──────────┘
                          │                                         │
                          │                                         ▼
                          │                              ┌──────────────────────┐
                          │                              │  Chat Orchestrator    │
                          │                              │ runs, fan-out, state  │
                          │                              └───────────┬──────────┘
                          │                                          │
                          │                  ┌───────────────────────┼───────────────────────┐
                          │                  ▼                       ▼                       ▼
                          │       ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
                          │       │   LLM Gateway     │    │   File Service    │    │ Workflow Worker  │
                          │       │ provider adapters │    │ upload/extraction │    │ council/jobs     │
                          │       └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
                          │                │                       │                       │
                          │                ▼                       ▼                       ▼
                          │       ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
                          │       │ LLM Providers     │    │ Cloudflare R2    │    │ Inngest          │
                          │       │ OpenAI, Claude... │    │ file storage     │    │ workflows        │
                          │       └──────────────────┘    └──────────────────┘    └──────────────────┘
                          │
                          ▼
              ┌─────────────────────────────────────────────────────────────────┐
              │                         Data Layer                              │
              │ Neon Postgres, Upstash Redis, audit logs, usage ledger, model data │
              └─────────────────────────────────────────────────────────────────┘
```

## Runtime Responsibilities

### Next.js Web App

Owns:

- Marketing pages.
- Auth pages.
- Chat UI.
- Settings UI.
- Dashboard UI.
- Local draft state.
- SSE subscription rendering.

Does not own:

- Provider key storage.
- Multi-model fan-out.
- Canonical conversation persistence.
- Provider-specific streaming.

### API Gateway / BFF

Owns:

- Auth validation.
- User/workspace resolution.
- Request validation.
- Rate limits.
- Quota checks.
- Chat run creation endpoints.
- Streaming endpoints.
- Settings APIs.
- Conversation CRUD APIs.

### Chat Orchestrator

Owns:

- Context assembly.
- Model selection validation.
- Fan-out execution.
- Cancellation.
- Retry coordination.
- Run persistence.
- Event emission.
- Usage accounting.

### LLM Gateway

Owns:

- Provider invocation.
- Provider-specific request shaping.
- Streaming normalization.
- Usage normalization.
- Provider error normalization.
- Fallback/circuit-break behavior.

### File Service

Owns:

- Upload URLs.
- Object storage writes.
- File metadata.
- Extraction jobs.
- OCR/transcription hooks.
- Attachment preparation for LLM calls.

### Workflow Worker

Owns:

- Council mode.
- File extraction.
- Long exports.
- Batch evals.
- Scheduled provider model sync.
- Cleanup jobs.

## Deployment Shape

Production deployment shape:

```txt
Cloudflare
  → Vercel web app
  → Render Web Service for API
  → Render Background Worker + Inngest handlers
  → Neon Postgres
  → Upstash Redis
  → Cloudflare R2
  → Infisical
```

## Key Request Flow: Compare Mode

```txt
1. User submits prompt to selected models.
2. Web calls POST /v1/chat/runs.
3. API authenticates user and validates request.
4. API creates chat_run and chat_model_run records.
5. API returns runId and opens/returns SSE stream.
6. Chat Orchestrator fans out to LLM Gateway.
7. LLM Gateway invokes providers.
8. Orchestrator emits model.started/model.delta/model.completed events.
9. UI updates each panel from the same stream.
10. Usage ledger and messages are persisted.
```

## Key Request Flow: Single Mode

Single mode uses the same run system with one selected model.

This avoids maintaining separate execution paths for single and compare modes.

## Key Request Flow: Council Mode

```txt
1. User starts council run.
2. API creates council_run.
3. Workflow Worker executes stage 1, 2, and 3.
4. Each model call goes through LLM Gateway.
5. UI subscribes to council run events.
6. Results are persisted stage by stage.
```
