# Coding Agent Execution Playbook

This playbook explains how an autonomous coding agent should execute the OmniMind v2 rebuild using the architecture documents.

Use this alongside the root [`AGENTS.md`](../AGENTS.md).

---

## 1. Mission

The agent's mission is to rebuild OmniMind into a production-grade, secure, observable, scalable multi-model AI platform.

The agent should behave like a careful staff engineer:

- Understand before changing.
- Phase work deliberately.
- Preserve architecture boundaries.
- Document decisions.
- Validate changes.
- Avoid premature complexity.

---

## 2. How to Start a Session

At the beginning of any new agent session:

1. Read `AGENTS.md`.
2. Choose the correct documentation reading mode from `AGENTS.md`:
   - Bootstrap Mode
   - Task Mode
   - Quick Fix Mode
3. Read only the docs required by that mode and task.
4. Inspect the current repository state.
5. Determine the current rebuild milestone.
6. Produce a short plan before editing.

Do not read every document for every small task. Use the master rebuild plan to orient yourself, then read task-specific docs.

Recommended initial command sequence:

```txt
pwd
ls -la
find docs -maxdepth 3 -type f | sort
find src -maxdepth 4 -type f | sort
```

Then read the relevant files using the file reader.

---

## 3. Phase-by-Phase Agent Plan

## Phase 0 — Foundation and Project Structure

### Goal

Create the technical foundation for the rebuild.

### Read First

```txt
docs/architecture/03-system-architecture.md
docs/architecture/04-technology-stack.md
docs/architecture/05-monorepo-structure.md
docs/architecture/18-roadmap.md
docs/architecture/19-domain-glossary.md
docs/architecture/20-engineering-standards.md
docs/adr/0001-dedicated-backend-orchestrator.md
```

### Tasks

1. Migrate package management to pnpm.
2. Add Turborepo.
3. Introduce monorepo structure.
4. Create `apps/web` from existing Next app.
5. Create `apps/api` skeleton.
6. Create `apps/worker` skeleton.
7. Create shared packages:
   - `packages/types`
   - `packages/config`
   - `packages/db`
   - `packages/ai`
   - `packages/telemetry`
   - `packages/ui`
8. Add root scripts for lint/type-check/test/build through Turborepo.
9. Add environment validation package.
10. Add API health route.

### Done When

- Monorepo builds minimally.
- Web app still runs.
- API has a health endpoint.
- Shared package imports work.

### Agent Warnings

- Do not rewrite all UI during this phase.
- Do not migrate chat behavior yet.
- Keep the MVP app functional if possible.

---

## Phase 1 — Auth, Workspace, and Persistence

### Goal

Move canonical conversations/messages toward server-side persistence.

### Read First

```txt
docs/architecture/06-frontend-architecture.md
docs/architecture/07-backend-architecture.md
docs/architecture/10-data-model.md
docs/architecture/11-api-design.md
docs/adr/0005-postgres-primary-store.md
```

### Tasks

1. Add Clerk authentication integration.
2. Add database schema for:
   - app_users
   - workspaces
   - workspace_members
   - conversations
   - messages
3. Create migrations.
4. Add repositories.
5. Add conversation/message APIs.
6. Wire Clerk auth/user context into API.
7. Add frontend API client.
8. Add TanStack Query for conversations/messages.
9. Add localStorage import path for old sessions.

### Done When

- Conversations persist server-side.
- Messages load from API.
- LocalStorage is not canonical for new conversations.

### Agent Warnings

- Do not remove old local data without migration/import UX.
- Do not mix database access directly into route handlers if repository layer exists.

---

## Phase 2 — Provider Key Vault

### Goal

Move provider API keys out of browser storage.

### Read First

```txt
docs/architecture/14-security.md
docs/architecture/11-api-design.md
docs/adr/0004-server-side-provider-key-vault.md
```

### Tasks

1. Add `provider_keys` table.
2. Add encryption abstraction.
3. Add provider key APIs:
   - list metadata
   - create/update key
   - delete key
   - validate key
4. Update settings UI.
5. Remove need to send provider key headers from frontend chat APIs.
6. Add audit logs for key changes.

### Done When

- Provider key plaintext is never returned to the browser.
- Browser does not store provider keys as v2 default.
- Backend can retrieve/decrypt key for provider calls.

### Agent Warnings

- Never log plaintext provider keys.
- Never include provider key in API responses.
- Use fingerprints only for display.

---

## Phase 3 — Model Registry

### Goal

Replace static-only model metadata with DB-backed model catalog.

### Read First

```txt
docs/architecture/08-llm-gateway.md
docs/architecture/10-data-model.md
docs/architecture/15-cost-controls.md
```

### Tasks

1. Add `model_catalog` table.
2. Seed initial known models.
3. Add model list API.
4. Add capability filters.
5. Update frontend model picker.
6. Move cost metadata to model registry.

### Done When

- Model picker reads from API.
- Backend validates model capability from registry.
- Pricing is not hardcoded in random provider files.

---

## Phase 4 — LLM Gateway

### Goal

Create the internal provider abstraction.

### Read First

```txt
docs/architecture/08-llm-gateway.md
docs/architecture/09-streaming-protocol.md
docs/architecture/15-cost-controls.md
docs/adr/0002-vercel-ai-sdk-gateway.md
```

### Tasks

1. Define `LLMGateway` interface.
2. Define normalized request/response/event types.
3. Add Vercel AI SDK integration.
4. Add provider adapters.
5. Add usage normalization.
6. Add error normalization.
7. Add capability checks.
8. Add tests for streamed provider responses.

### Done When

- At least two providers can be called through the gateway.
- Provider-specific details are hidden from app code.
- Gateway tests cover success, error, and cancellation paths.

### Agent Warnings

- Do not let API routes call provider SDKs directly once gateway exists.
- Do not expose provider-specific stream formats to frontend.

---

## Phase 5 — Chat Run Engine

### Goal

Implement the durable backend run system.

### Read First

```txt
docs/architecture/07-backend-architecture.md
docs/architecture/09-streaming-protocol.md
docs/architecture/10-data-model.md
docs/architecture/11-api-design.md
```

### Tasks

1. Add `chat_runs`, `chat_model_runs`, `chat_run_events`, `usage_ledger`.
2. Implement `POST /v1/chat/runs`.
3. Implement `GET /v1/chat/runs/:runId/events`.
4. Implement cancellation endpoint.
5. Implement per-model fan-out.
6. Persist assistant messages.
7. Write usage ledger.
8. Add idempotency handling.
9. Add SSE event tests.

### Done When

- One prompt creates one run.
- Multiple selected models create multiple model runs.
- UI can receive typed stream events.
- Usage/cost are persisted.

### Agent Warnings

- Avoid long DB transactions around provider calls.
- Design for partial failure.
- Ensure cancellation is best-effort but stateful.

---

## Phase 6 — Frontend Migration to Backend Runs

### Goal

Migrate single and compare chat UI to backend run system.

### Read First

```txt
docs/architecture/06-frontend-architecture.md
docs/architecture/09-streaming-protocol.md
docs/architecture/11-api-design.md
```

### Tasks

1. Add `useChatRun` hook.
2. Add typed SSE client.
3. Update composer to call run API once.
4. Update model panels to render by `modelRunId`.
5. Remove direct provider fan-out from components.
6. Reconcile stream buffers with persisted messages.
7. Add cancellation UI.

### Done When

- Single mode uses chat runs.
- Compare mode uses chat runs.
- No React component directly calls provider APIs.

### Agent Warnings

- Do not preserve old fan-out logic as another production path.
- Use feature flags if migration must be gradual.

---

## Phase 7 — File Pipeline

### Goal

Move file handling to Cloudflare R2 and extraction jobs.

### Read First

```txt
docs/architecture/12-file-pipeline.md
docs/architecture/14-security.md
docs/architecture/08-llm-gateway.md
```

### Tasks

1. Add `files`, `message_attachments`, `file_extractions` tables.
2. Add upload APIs.
3. Add Cloudflare R2 integration.
4. Add extraction worker.
5. Update composer to upload before submit.
6. Pass attachment IDs to chat runs.
7. Let LLM Gateway prepare provider-specific attachment inputs.

### Done When

- Files are not stored as base64 in canonical messages.
- PDF/text/image files can be used in chat.
- File access is workspace-scoped.

---

## Phase 8 — Council Workflow v2

### Goal

Make Council Mode durable and backend-driven.

### Read First

```txt
docs/architecture/13-council-workflow.md
docs/architecture/09-streaming-protocol.md
docs/architecture/08-llm-gateway.md
```

### Tasks

1. Add council tables.
2. Add council run API.
3. Add workflow implementation.
4. Add stage event stream.
5. Persist stage outputs.
6. Add ranking aggregation.
7. Add final synthesis.
8. Migrate council UI.

### Done When

- Council runs survive browser reloads.
- Stage results persist.
- Partial failures are visible.

---

## Phase 9 — Observability and Hardening

### Goal

Make the app production-operable.

### Read First

```txt
docs/architecture/14-security.md
docs/architecture/15-cost-controls.md
docs/architecture/16-observability.md
docs/architecture/17-infrastructure.md
```

### Tasks

1. Add structured logging.
2. Add request IDs.
3. Add Sentry.
4. Add OpenTelemetry spans.
5. Add Langfuse traces.
6. Add usage dashboard.
7. Add budget checks.
8. Add Redis-backed rate limits.
9. Add production runbooks.
10. Add load tests for SSE.

### Done When

- A run can be debugged by run ID.
- Cost is visible by model/provider.
- Limits prevent uncontrolled hosted spend.
- Production deployment docs are accurate.

---

## 4. Task Planning Template

Before editing, an agent should produce a short plan like this:

```txt
Phase: Phase 4 — LLM Gateway
Docs read:
- docs/architecture/08-llm-gateway.md
- docs/adr/0002-vercel-ai-sdk-gateway.md

Current code touched:
- src/lib/providers/*
- packages/ai/src/*

Plan:
1. Define normalized gateway interfaces.
2. Add OpenAI adapter using Vercel AI SDK.
3. Add error normalization helper.
4. Add tests for stream delta handling.
5. Update docs if event shape changes.

Validation:
- type-check
- unit tests
```

---

## 5. Pull Request / Final Response Template

Every completed task should summarize:

```txt
Summary:
- What changed.

Files changed:
- path/to/file

Validation:
- command run and result
- or reason not run

Architecture notes:
- Any docs/ADR updated.
- Any risks or follow-ups.

Next steps:
- Recommended next task.
```

---

## 6. Risk Management

High-risk areas:

- Provider key encryption.
- Streaming event protocol.
- Database migrations.
- Multi-model cancellation.
- Usage/cost accounting.
- File access permissions.

Agents should make these changes in smaller increments with tests.

---

## 7. Migration Strategy From Current MVP

The current app can be treated as the UX prototype.

Recommended migration path:

```txt
1. Preserve current app behavior.
2. Introduce new backend primitives.
3. Migrate one vertical slice at a time.
4. Use feature flags if necessary.
5. Remove legacy paths after equivalent v2 path works.
```

Vertical slices are preferred over massive rewrites.

Example vertical slice:

```txt
Save provider key server-side
  → call one model through backend LLM Gateway
  → persist run/message
  → stream response to frontend
```

Then expand to compare mode.

---

## 8. Agent Anti-Patterns

Avoid these:

- Building UI first while backend contracts are undefined.
- Creating a second MVP inside the rebuild.
- Adding quick hacks that contradict docs.
- Implementing provider-specific logic in three places.
- Skipping persistence to “get streaming working.”
- Skipping usage ledger because “we can add it later.”
- Adding localStorage canonical state again.
- Using raw `fetch` everywhere instead of feature API clients.
- Failing to update docs after changing contracts.

---

## 9. Recommended First Implementation Milestone

The first milestone should be:

```txt
M0: Monorepo + API health + shared types + DB package skeleton
```

Why:

- Establishes architecture boundaries.
- Reduces future migration pain.
- Allows backend work to proceed independently.
- Creates foundation for run engine and provider key vault.

Suggested first concrete tasks:

1. Move current Next app into `apps/web` or prepare workspace layout.
2. Add root workspace config.
3. Add `apps/api` with health endpoint.
4. Add `packages/types` with initial shared health/error schemas.
5. Add `packages/config` with env validation.
6. Add `packages/db` skeleton.
7. Add `packages/ui` skeleton.
8. Add root scripts through Turborepo.

---

## 10. Final Guidance

When choosing between speed and architectural clarity, choose architectural clarity for foundation work.

When choosing between a perfect abstraction and a simple working boundary, choose the simple working boundary.

When changing irreversible decisions, add or update an ADR.
