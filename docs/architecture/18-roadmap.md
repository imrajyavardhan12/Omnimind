# 18 — Migration and Implementation Roadmap

## Overview

The rebuild should be incremental but decisive. The goal is not to polish the current MVP forever, but to introduce a production-grade architecture and migrate features onto it.

## Phase 0 — Foundation and Decisions

Deliverables:

- Documentation finalized.
- ADRs accepted.
- Monorepo created.
- Shared type package created.
- Environment validation added.
- CI pipeline established.
- Basic API service skeleton.
- Basic DB schema and migrations.

Exit criteria:

- `apps/web`, `apps/api`, `apps/worker`, and shared packages exist.
- API health endpoint deployed to staging.
- Database migrations run in staging.

## Phase 1 — Auth, Workspace, and Persistence

Deliverables:

- Workspace model.
- Workspace membership.
- Conversation tables.
- Message tables.
- Conversation CRUD API.
- Frontend migrated from localStorage canonical state to server conversations.
- Legacy localStorage import path.

Exit criteria:

- A user can log in and see conversations persisted across reloads/devices.

## Phase 2 — Provider Key Vault

Deliverables:

- Provider key table.
- App-level envelope encryption using Infisical-managed root secrets.
- Provider key CRUD APIs.
- Provider key validation.
- Settings UI migrated to server-side provider keys.
- Frontend no longer sends provider API keys on chat requests.

Exit criteria:

- User can save a provider key once.
- Chat APIs can use the key server-side.
- Plaintext key is never returned to browser.

## Phase 3 — Model Registry

Deliverables:

- `model_catalog` table.
- Seeded model metadata.
- Model list API.
- Capability flags.
- Pricing metadata.
- Admin/internal model sync job.

Exit criteria:

- Frontend model picker reads from API-backed catalog.
- Backend validates requested models against registry.

## Phase 4 — LLM Gateway

Deliverables:

- `packages/ai` created.
- LLM Gateway interface.
- Vercel AI SDK integration.
- Provider adapters for OpenAI, Anthropic, Gemini, OpenRouter.
- Normalized errors.
- Normalized usage.
- Token/cost calculation from model catalog.

Exit criteria:

- API can call at least two providers through the gateway.
- Gateway tests cover streaming and errors.

## Phase 5 — Chat Run Engine

Deliverables:

- `chat_runs` and `chat_model_runs`.
- `POST /v1/chat/runs`.
- `GET /v1/chat/runs/:runId/events`.
- Unified SSE protocol.
- Cancellation endpoint.
- Usage ledger writes.
- Single mode migrated.
- Compare mode migrated.

Exit criteria:

- Single and compare modes both use backend chat runs.
- Frontend no longer fans out directly to providers.
- Per-model streaming, errors, and usage render correctly.

## Phase 6 — File Pipeline

Deliverables:

- File metadata table.
- Object storage integration.
- Upload URL API.
- File extraction worker.
- Image support through LLM Gateway.
- Text/PDF extraction support.
- Composer submits attachment IDs, not base64.

Exit criteria:

- User can upload a PDF or image and use it in chat.
- File content is stored outside localStorage.

## Phase 7 — Council Mode v2

Deliverables:

- Council run tables.
- Workflow implementation.
- Council event stream.
- Stage persistence.
- Ranking parser and aggregate logic.
- Chairman synthesis.
- Council UI migrated to backend workflow.

Exit criteria:

- Council runs survive browser refresh.
- Partial failures are visible and handled.

## Phase 8 — Observability and Cost Controls

Deliverables:

- Sentry.
- Structured logs.
- OpenTelemetry traces.
- Langfuse LLM traces.
- Usage dashboard.
- Budget settings.
- Rate limits.
- Alerts.

Exit criteria:

- Any run can be debugged by run ID.
- Cost by provider/model is visible.
- Hosted usage cannot exceed configured budgets silently.

## Phase 9 — Hardening and Production Launch

Deliverables:

- Security review.
- Load tests for SSE.
- Provider outage tests.
- Backup/restore test.
- Runbooks.
- Error UX polish.
- Performance pass.
- Accessibility pass.

Exit criteria:

- Production environment is ready.
- On-call/debug docs exist.
- Launch checklist completed.

## Suggested Build Order

Most important order:

```txt
1. Monorepo + API skeleton
2. Database schema
3. Provider key vault
4. LLM Gateway
5. Chat run engine
6. Frontend migration
7. Files
8. Council
9. Observability/cost hardening
```

## Things to Avoid During Rebuild

- Rewriting UI before backend architecture exists.
- Adding more localStorage persistence.
- Keeping provider keys in client storage.
- Building Council v2 in React hooks.
- Adding more provider-specific code directly to API routes.
- Introducing Kubernetes prematurely.

## Definition of Done for v2 Core

OmniMind v2 core is done when:

1. Authenticated users have server-persisted conversations.
2. Provider keys are stored server-side encrypted.
3. Single and compare modes use the same chat run engine.
4. All model calls go through the LLM Gateway.
5. Streaming is unified through SSE.
6. Usage and cost are tracked per model run.
7. Basic observability is live.
8. The current MVP functionality is matched or improved.
