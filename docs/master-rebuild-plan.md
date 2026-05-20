# OmniMind v2 Master Rebuild Plan

This is the end-to-end execution plan for rebuilding OmniMind from MVP architecture into a production-grade multi-model AI platform.

Use this document as the single high-level guide from start to finish.

Detailed architecture lives in `docs/architecture/*`. This document connects those details into an execution sequence with milestones, dependencies, exit criteria, and recommended agent handoffs.

---

## 1. Rebuild Philosophy

The v2 rebuild should be treated as a controlled platform migration, not a chaotic rewrite.

Core philosophy:

```txt
Stabilize foundations → introduce backend boundaries → migrate one vertical slice → expand safely → harden for production
```

Do not start by redesigning the UI.
Do not start by implementing fancy AI features.
Do not start by rewriting all chat logic at once.

Start by creating the architecture boundaries that make the rest of the rebuild possible.

---

## 2. North Star

Target architecture:

```txt
Cloudflare/CDN/WAF
  ├── Next.js Web App
  └── API Gateway/BFF
        ├── Chat Orchestrator
        ├── LLM Gateway
        ├── File Service
        ├── Workflow Worker
        ├── Neon Postgres
        ├── Upstash Redis
        └── Cloudflare R2
```

Target product feel:

```txt
Ask once. Compare intelligently. Trust what happened.
```

---

## 3. Milestone Overview

```txt
M0  Foundation and monorepo boundaries
M1  Server persistence foundation
M2  Server-side provider key vault
M3  Model registry
M4  LLM Gateway
M5  Chat run engine
M6  Frontend migration to backend runs
M7  File and multimodal pipeline
M8  Council Mode v2
M9  Observability, cost controls, and hardening
M10 Production launch readiness
M11 Post-launch iteration and cleanup
```

---

## 4. Dependency Map

```txt
M0 Foundation
  ├── M1 Persistence
  │     ├── M2 Provider Key Vault
  │     ├── M3 Model Registry
  │     │     └── M4 LLM Gateway
  │     │            └── M5 Chat Run Engine
  │     │                   └── M6 Frontend Migration
  │     │                          ├── M7 File Pipeline
  │     │                          └── M8 Council Mode v2
  │     └── M9 Observability/Cost Controls
  └── M10 Production Launch
```

Critical path:

```txt
M0 → M1 → M2/M3 → M4 → M5 → M6 → M9 → M10
```

---

## 5. Milestone M0 — Foundation and Monorepo Boundaries

### Objective

Create the project structure that allows the rebuild to proceed safely.

### Required Docs

```txt
AGENTS.md
docs/agent-execution-playbook.md
docs/architecture/03-system-architecture.md
docs/architecture/04-technology-stack.md
docs/architecture/05-monorepo-structure.md
docs/architecture/18-roadmap.md
docs/architecture/19-domain-glossary.md
docs/architecture/20-engineering-standards.md
docs/adr/0001-dedicated-backend-orchestrator.md
docs/adr/0006-definitive-v2-platform-stack.md
```

### Work

- Prepare monorepo/workspace layout.
- Preserve current Next.js app as `apps/web` if safe.
- Add `apps/api` skeleton.
- Add `apps/worker` skeleton.
- Migrate package tooling to pnpm + Turborepo.
- Remove legacy Bun workflow after pnpm is established.
- Add package skeletons:
  - `packages/types`
  - `packages/config`
  - `packages/db`
  - `packages/ai`
  - `packages/telemetry`
  - `packages/ui`
- Add API health endpoint.
- Add root scripts.
- Add basic environment validation skeleton.

### Exit Criteria

- Existing web app still runs or migration risk is clearly documented.
- API health endpoint works.
- Shared package imports work.
- Root scripts are coherent.
- No chat behavior changed.

### Do Not

- Do not migrate chat.
- Do not implement database schema yet beyond skeleton.
- Do not rewrite UI.
- Do not touch provider orchestration.

---

## 6. Milestone M1 — Server Persistence Foundation

### Objective

Move toward server-side canonical state.

### Required Docs

```txt
docs/architecture/07-backend-architecture.md
docs/architecture/10-data-model.md
docs/architecture/11-api-design.md
docs/adr/0005-postgres-primary-store.md
```

### Work

- Add Drizzle setup.
- Add Clerk authentication integration.
- Add initial schema:
  - `app_users`
  - `workspaces`
  - `workspace_members`
  - `conversations`
  - `messages`
- Add migrations.
- Add database client.
- Add repositories.
- Add conversation/message APIs.
- Add Clerk user to internal user/workspace resolution middleware.
- Add minimal frontend API client and TanStack Query setup.

### Exit Criteria

- Authenticated user has a default workspace.
- Conversations can be created/listed/fetched server-side.
- Messages can be persisted server-side.
- Current localStorage sessions are not destroyed.

### Do Not

- Do not remove legacy localStorage until import/migration path exists.
- Do not add provider calls to persistence APIs.

---

## 7. Milestone M2 — Server-Side Provider Key Vault

### Objective

Make BYOK production-safe.

### Required Docs

```txt
docs/architecture/14-security.md
docs/adr/0004-server-side-provider-key-vault.md
docs/architecture/11-api-design.md
```

### Work

- Add `provider_keys` table.
- Add encryption abstraction.
- Add key fingerprinting.
- Add provider key APIs:
  - list metadata
  - create/update
  - delete
  - validate
- Add audit logs for key changes.
- Update settings UI.
- Stop frontend from sending provider keys for v2 chat paths.

### Exit Criteria

- Provider keys are encrypted server-side.
- Plaintext provider keys are never returned to browser.
- Provider key metadata shows connected/invalid status.
- Settings UX uses server-side key APIs.

### Do Not

- Do not log provider keys.
- Do not store keys in localStorage as v2 default.

---

## 8. Milestone M3 — Model Registry

### Objective

Create a server-owned model catalog with capabilities and pricing.

### Required Docs

```txt
docs/architecture/08-llm-gateway.md
docs/architecture/10-data-model.md
docs/architecture/15-cost-controls.md
```

### Work

- Add `model_catalog` table.
- Seed current model metadata.
- Add capability fields.
- Add pricing fields.
- Add model list API.
- Update model picker to read from API.
- Add model capability validation helpers.

### Exit Criteria

- Frontend model selection is API-backed.
- Backend validates provider/model against registry.
- Cost calculation can use model registry pricing.

---

## 9. Milestone M4 — LLM Gateway

### Objective

Centralize all provider interaction behind a typed internal gateway.

### Required Docs

```txt
docs/architecture/08-llm-gateway.md
docs/architecture/09-streaming-protocol.md
docs/architecture/15-cost-controls.md
docs/adr/0002-vercel-ai-sdk-gateway.md
```

### Work

- Define normalized LLM request/response/event types.
- Implement LLM Gateway interface.
- Integrate Vercel AI SDK.
- Implement provider adapters incrementally.
- Normalize provider errors.
- Normalize provider usage.
- Add model capability checks.
- Add tests with fake provider streams.

### Exit Criteria

- OpenAI and Anthropic work through the gateway.
- API/service code does not need provider-specific stream parsing.
- Gateway tests cover success, error, cancellation, and usage normalization.

### Do Not

- Do not scatter Vercel AI SDK calls outside the gateway.
- Do not expose raw provider stream events to frontend.

---

## 10. Milestone M5 — Chat Run Engine

### Objective

Create the durable backend orchestration engine for single and compare mode.

### Required Docs

```txt
docs/architecture/07-backend-architecture.md
docs/architecture/09-streaming-protocol.md
docs/architecture/10-data-model.md
docs/architecture/11-api-design.md
```

### Work

- Add tables:
  - `chat_runs`
  - `chat_model_runs`
  - `chat_run_events`
  - `usage_ledger`
- Implement `POST /v1/chat/runs`.
- Implement `GET /v1/chat/runs/:runId/events`.
- Implement `POST /v1/chat/runs/:runId/cancel`.
- Implement backend fan-out.
- Persist user and assistant messages.
- Write usage ledger.
- Emit typed SSE events.
- Add idempotency support.

### Exit Criteria

- One user prompt creates one chat run.
- One selected model creates one model run.
- Multiple selected models run from the backend.
- SSE stream emits typed events.
- Usage ledger records completed model calls.
- Cancellation changes backend state.

### Do Not

- Do not keep frontend fan-out as the primary v2 path.
- Do not skip usage ledger.

---

## 11. Milestone M6 — Frontend Migration to Backend Runs

### Objective

Move user-facing chat modes onto the backend run engine.

### Required Docs

```txt
docs/architecture/06-frontend-architecture.md
docs/architecture/09-streaming-protocol.md
docs/architecture/11-api-design.md
docs/architecture/22-product-ux-principles.md
```

### Work

- Add typed chat API client.
- Add SSE client.
- Add `useChatRun` hook.
- Update single mode composer to create backend run.
- Update compare mode composer to create one backend run.
- Update response panels to render by `modelRunId`.
- Remove/feature-flag old direct fan-out.
- Reconcile streamed content with persisted messages.

### Exit Criteria

- Single mode uses chat runs.
- Compare mode uses chat runs.
- Frontend no longer sends provider keys.
- Frontend no longer directly fans out to provider calls.
- Per-model status/errors/cost render clearly.

---

## 12. Milestone M7 — File and Multimodal Pipeline

### Objective

Make file handling durable, secure, and model-aware.

### Required Docs

```txt
docs/architecture/12-file-pipeline.md
docs/architecture/14-security.md
docs/architecture/08-llm-gateway.md
```

### Work

- Add file tables.
- Add Cloudflare R2 integration.
- Add signed upload flow.
- Add file extraction worker.
- Update composer to upload files before run creation.
- Send attachment IDs to chat run API.
- Let LLM Gateway prepare model-specific attachment payloads.

### Exit Criteria

- Files are not stored as canonical base64 message payloads.
- Images can be used by vision models.
- Text/PDF extraction works minimally.
- File access is workspace-scoped.

---

## 13. Milestone M8 — Council Mode v2

### Objective

Make Council Mode a durable backend workflow.

### Required Docs

```txt
docs/architecture/13-council-workflow.md
docs/architecture/09-streaming-protocol.md
docs/architecture/08-llm-gateway.md
```

### Work

- Add council tables.
- Add council run API.
- Add workflow implementation.
- Add stage event stream.
- Persist individual responses.
- Persist peer rankings.
- Add aggregation.
- Add chairman synthesis.
- Update Council UI.

### Exit Criteria

- Council run survives refresh.
- Stage results are persisted.
- Partial failures are handled.
- Final report is durable.

---

## 14. Milestone M9 — Observability, Cost Controls, and Hardening

### Objective

Make the system operable and safe in production.

### Required Docs

```txt
docs/architecture/15-cost-controls.md
docs/architecture/16-observability.md
docs/architecture/21-testing-strategy.md
docs/architecture/24-risk-register.md
```

### Work

- Add structured logging.
- Add request IDs.
- Add Sentry.
- Add OpenTelemetry.
- Add Langfuse.
- Add Redis-backed rate limits.
- Add budget checks.
- Add usage dashboard.
- Add provider health/circuit breaker basics.
- Add critical tests.

### Exit Criteria

- Any run can be debugged by run ID.
- Provider/model latency and errors are visible.
- Usage/cost by provider/model is visible.
- Rate limits are active.
- Hosted provider spend is protected.

---

## 15. Milestone M10 — Production Launch Readiness

### Objective

Prepare v2 for production rollout.

### Required Docs

```txt
docs/architecture/17-infrastructure.md
docs/architecture/23-launch-checklist.md
docs/runbooks.md
```

### Work

- Configure staging and production environments.
- Validate migrations.
- Validate backups.
- Validate rollback procedure.
- Run E2E tests.
- Run SSE load test.
- Run provider failure tests.
- Complete launch checklist.
- Complete runbooks.

### Exit Criteria

- Launch checklist signed off.
- Smoke tests pass in staging.
- Rollback plan exists.
- Production monitoring is live.

---

## 16. Milestone M11 — Post-Launch Cleanup and Iteration

### Objective

Remove legacy paths and improve product quality after v2 is stable.

### Work

- Remove old localStorage canonical chat paths.
- Remove legacy provider route logic.
- Remove dead components.
- Improve model comparison summaries.
- Add response rating/feedback.
- Improve usage dashboards.
- Add workspace collaboration features if desired.
- Add RAG/vector search if file usage demands it.

### Exit Criteria

- Legacy MVP paths are removed or clearly feature-flagged.
- v2 architecture is the only production path.
- Product quality improvements are driven by usage data.

---

## 17. Recommended Agent Handoff Format

At the end of every task, the agent should leave a handoff note:

```txt
Phase/Milestone:
Summary:
Files changed:
Validation:
Known risks:
Next recommended task:
Docs updated:
```

For long-running rebuilds, this is critical.

---

## 18. Stop Conditions

Pause and ask for review if:

- A migration is destructive.
- A secret handling design changes.
- A public API contract changes significantly.
- A stream event contract changes.
- A new infrastructure provider is introduced.
- A task requires broad UI and backend changes at once.
- A phase's exit criteria cannot be met.

---

## 19. Quality Gates

Each milestone should pass these gates before moving on.

### Architecture Gate

- Does this align with docs?
- If not, were docs/ADRs updated?

### Security Gate

- Are secrets protected?
- Is workspace authorization respected?

### Data Gate

- Is canonical state server-side where intended?
- Are migrations safe?

### Observability Gate

- Can this be debugged in production?

### UX Gate

- Are loading/error states understandable?

### Cost Gate

- Could this accidentally create uncontrolled provider spend?

---

## 20. The First Vertical Slice

After M0–M4, the first real vertical slice should be:

```txt
User saves OpenAI key server-side
  → user creates one conversation
  → user sends one prompt to one model
  → backend creates chat_run/model_run
  → LLM Gateway streams response
  → message persists
  → usage ledger records cost
  → frontend renders from SSE
```

This proves the architecture end to end before expanding to compare mode.

---

## 21. Final Definition of v2 Core Complete

OmniMind v2 core is complete when:

- Users have server-persisted conversations.
- Provider keys are encrypted server-side.
- Single mode uses chat runs.
- Compare mode uses chat runs.
- All model calls go through LLM Gateway.
- Streaming is unified through SSE.
- Usage/cost are tracked per model run.
- File upload pipeline exists.
- Council Mode is durable through the v2 backend workflow architecture.
- Observability and rate limits are active.
- Legacy MVP execution paths are removed from the production path.

---

## 22. Guiding Reminder

The rebuild is successful only if the system becomes easier to reason about than the MVP.

If a change makes the system feel clever but harder to operate, reconsider it.

If a change improves boundaries, durability, observability, and security, it is probably the right direction.
