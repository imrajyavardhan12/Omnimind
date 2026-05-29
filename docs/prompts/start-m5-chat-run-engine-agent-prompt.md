# Start M5 Chat Run Engine Coding-Agent Prompt

Use this prompt when starting a new coding-agent session after M4B — Gateway API route + SSE has been completed and reviewed.

---

```txt
We have completed and reviewed OmniMind v2 M0 through M4B.

The authoritative milestone sequence is:
M4B — Gateway API + SSE     ✅ done
M5  — Chat Run Engine       ← current
M6  — Frontend Migration    (rewire UI onto backend runs)
M7  — File Pipeline
M8  — Council Mode v2
M9  — Observability / Cost Controls / Hardening

We are now starting M5 — Chat Run Engine.

Use Bootstrap Mode from @AGENTS.md because this is a new major milestone
that introduces new database tables, new API endpoints, and changes the
streaming contract.

Read these first:

@AGENTS.md
@docs/handoff-m4b.md
@docs/handoff-m4a.md
@docs/architecture/07-backend-architecture.md
@docs/architecture/09-streaming-protocol.md
@docs/architecture/10-data-model.md
@docs/architecture/11-api-design.md
@docs/architecture/14-security.md
@docs/architecture/20-engineering-standards.md

Also skim (no need to re-read in full if you remember them):

@docs/architecture/06-frontend-architecture.md
@docs/architecture/08-llm-gateway.md
@docs/architecture/15-cost-controls.md

Also find and read prior handoff files (m0 through m4b). If you cannot
find one, state that clearly and continue by inspecting the repository.

---

Pre-flight checklist (must ALL be confirmed before writing code):

1. M4B manual end-to-end smoke has been performed. If not, the M4B
   handoff marked it as BLOCKED. Confirm the smoke is done (migration
   0002 applied, seed applied, real provider key test). If the smoke
   was never performed, RUN IT NOW before starting M5.
2. `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build` all pass.
3. The existing M4B `POST /v1/chat/stream` route works (it will be
   replaced/evolved by M5's `POST /v1/chat/runs` route).
4. The existing `messages` table has a nullable `modelRunId` column
   (check `packages/db/src/schema/conversations.ts`).

---

Task:

1. Re-establish current project state after M4B.
2. Produce a scoped M5 implementation plan with sub-slices.
3. Implement M5 as defined below.

---

M5 scope: Chat Run Engine — durable runs with persistence

M5 replaces the M4B "stream without persistence" path with a proper
chat run engine. After M5, every user prompt creates a durable `chat_run`
row, every model response creates a `chat_model_run` row, user and
assistant messages are persisted to the `messages` table, usage is
recorded in the `usage_ledger`, and the SSE stream emits the full
typed event envelope from `09-streaming-protocol.md`.

M5 does NOT implement:
- Frontend migration to backend runs (that is M6).
- Removal of the legacy `useChat` hook or `apps/web/src/app/api/chat/route.ts` (M6).
- Multi-model compare mode fan-out (M5 supports it in the schema but
  the route can start with single-model; compare fan-out can be M5B).
- Council workflow (M8).
- File/attachment handling (M7).
- Rate limiting / quotas / budgets (M9).
- Circuit breaker / fallback routing (M9).

If scope creep appears, stop, note it, and defer to the appropriate milestone.

---

M5 implementation targets:

## 1. Database schema (packages/db)

Add new schema files:

  packages/db/src/schema/chat-runs.ts
    - `chat_runs` table per 10-data-model.md:
      id, workspace_id, conversation_id, created_by_user_id,
      input_message_id (nullable — set after user message insert),
      mode (single | compare), status (queued | running | completed |
      failed | cancelled), idempotency_key (nullable, unique),
      started_at, completed_at, created_at, updated_at
    - `chat_model_runs` table:
      id, chat_run_id, workspace_id, provider, model,
      status (queued | running | retrying | completed | failed | cancelled),
      settings_json (nullable), output_message_id (nullable),
      provider_request_id (nullable), error_code (nullable),
      error_message (nullable), input_tokens (nullable),
      output_tokens (nullable), total_tokens (nullable),
      usage_source (provider | estimated, nullable),
      cost_usd (nullable), latency_ms (nullable),
      started_at (nullable), completed_at (nullable),
      created_at, updated_at
    - `chat_run_events` table:
      id, chat_run_id, sequence (integer), event_type (text),
      payload_json (jsonb nullable), created_at

  packages/db/src/schema/usage-ledger.ts
    - `usage_ledger` table per 10-data-model.md:
      id, workspace_id, user_id, conversation_id (nullable),
      chat_run_id (nullable), chat_model_run_id (nullable),
      provider, model, input_tokens, output_tokens, total_tokens,
      usage_source (provider | estimated), cost_usd (text — decimal-safe),
      currency (default 'USD'), created_at

  Update packages/db/src/schema/index.ts to re-export new tables.

  Generate migration: `pnpm --filter @omnimind/db db:generate`
  The migration MUST be generated, not hand-written.
  DO NOT apply the migration to Neon — that is a manual step.

## 2. Repositories (packages/db)

  packages/db/src/repositories/chat-run.repository.ts
    - create(input): insert chat_run, return row
    - findById(id): select by id
    - updateStatus(id, status, completedAt?): update status
    - findByConversation(conversationId, limit, cursor): paginated list

  packages/db/src/repositories/chat-model-run.repository.ts
    - create(input): insert chat_model_run, return row
    - findByChatRun(chatRunId): list model runs for a chat run
    - updateStatus(id, status, updates?): partial update (status, tokens,
      cost, error, output_message_id, completed_at, latency_ms, etc.)
    - findById(id): select by id

  packages/db/src/repositories/chat-run-event.repository.ts
    - create(input): insert event row
    - findByChatRun(chatRunId, afterSequence?): for replay/reconnect

  packages/db/src/repositories/usage-ledger.repository.ts
    - create(input): insert usage row (append-only)
    - findByWorkspace(workspaceId, filters): paginated, filterable

  Update packages/db/src/index.ts to export new repositories.

## 3. Chat Run Service (packages/db or apps/api)

  Create a ChatRunService (or ChatOrchestrator) that encapsulates the
  run lifecycle. This can live in apps/api/src/services/ for now
  (moving to a shared package later is fine).

  The service must:
  a. Validate idempotency key — if a run with the same key exists and
     is not failed, return the existing run (do not create a duplicate).
  b. Create a `chat_run` row (status: queued).
  c. Insert the user message into `messages` (role: user).
  d. Update `chat_run.input_message_id` to the user message id.
  e. Create one `chat_model_run` row per selected model (status: queued).
  f. Transition `chat_run.status` → running, set `started_at`.
  g. For each model run (sequentially for M5, fan-out in M5B):
     - Transition `chat_model_run.status` → running, set `started_at`.
     - Fetch + decrypt the provider key (same pattern as M4B).
     - Call `LLMGateway.stream()`.
     - Yield typed SSE events: `model.started`, `model.delta`,
       `model.completed` / `model.failed`.
     - On completion: persist assistant message (role: assistant,
       model_run_id set), update `chat_model_run` with tokens/cost/
       latency/output_message_id, write `usage_ledger` entry.
     - On failure: update `chat_model_run` with error_code/error_message.
  h. After all model runs: transition `chat_run.status` → completed
     (or failed if all model runs failed), set `completed_at`.
  i. Yield `run.started` and `run.completed` / `run.failed` events.
  j. On cancellation (AbortSignal): transition statuses to cancelled,
     yield `model.cancelled` / `run.cancelled`.

  Transaction boundaries:
  - Use a transaction for (b + c + d + e) — the initial run setup.
  - Use a transaction for (assistant message + model run update +
    usage ledger) per model completion.
  - Do NOT hold a transaction open during provider streaming.

## 4. API routes (apps/api)

  Replace or evolve the M4B `POST /v1/chat/stream` into the proper
  create-then-subscribe pattern from `09-streaming-protocol.md`:

  POST /v1/chat/runs
    - Validate body (new schema — extends gatewayRequestSchema with
      conversationId, models array, context settings, idempotency key).
    - Role check: viewers cannot create runs.
    - Create the run via ChatRunService.
    - Return JSON: `{ runId, conversationId, eventStreamUrl }`.

  GET /v1/chat/runs/:runId/events
    - Auth + workspace scoping.
    - If run is already completed/failed/cancelled, return the persisted
      events (replay from chat_run_events).
    - If run is active, open SSE stream and pipe live events.
    - Support `afterSequence` query param for reconnection.
    - Use the same SSE format: `event: <type>`, `data: <envelope JSON>`.

  POST /v1/chat/runs/:runId/cancel
    - Auth + workspace scoping.
    - Set cancellation flag, abort active provider requests.
    - Return `{ status: 'cancelled' }`.

  GET /v1/chat/runs/:runId
    - Auth + workspace scoping.
    - Return the run row + model run rows.

  Wire all routes under `v1.route('/chat/runs', ...)` in apps/api/src/index.ts.

  The M4B `POST /v1/chat/stream` route can be KEPT as a lightweight
  alias or REMOVED — agent's choice, but document the decision. If kept,
  it should delegate to the new run engine internally. If removed,
  update the M4B handoff to note the removal.

## 5. SSE event envelope (packages/types)

  Add the full event envelope types from `09-streaming-protocol.md`:

  StreamEnvelope<TType, TData> = {
    type: TType
    runId: string
    sequence: number
    timestamp: string
    data: TData
  }

  Event types:
    run.started, run.completed, run.failed, run.cancelled
    model.queued, model.started, model.delta, model.retrying,
    model.completed, model.failed, model.cancelled
    usage.updated
    heartbeat, error

  Add Zod schemas for each event type.

## 6. Tests

  - Repository tests for chat-run, chat-model-run, usage-ledger
    (mock the db or use Drizzle's test utilities).
  - ChatRunService unit tests:
    - Happy path: creates run + model run + messages + usage.
    - Idempotency: duplicate key returns existing run.
    - Gateway error: model run marked failed, run still completes.
    - Cancellation: statuses transition to cancelled.
  - API route tests:
    - POST /v1/chat/runs: validation, role check, happy path.
    - GET /v1/chat/runs/:runId/events: SSE event format.
    - POST /v1/chat/runs/:runId/cancel: status transition.
    - GET /v1/chat/runs/:runId: returns run + model runs.

## 7. Cost calculation

  Use model_catalog pricing (input_cost_per_1m, output_cost_per_1m)
  to calculate `cost_usd` on chat_model_run completion.

  Use decimal-safe string arithmetic or integer-cents representation.
  Do NOT use floating-point multiplication for cost — use the pattern:
    cost = (tokens / 1_000_000) * costPer1M
  with string-based decimal handling (e.g., multiply as integers,
  then format).

  A simple helper in packages/ai or packages/db is fine:
    calculateCost(inputTokens, outputTokens, inputCostPer1M, outputCostPer1M): string

---

Suggested M5 slicing if too large for one session:

M5A — Schema + repositories + migration:
  - Add chat_runs, chat_model_runs, chat_run_events, usage_ledger tables.
  - Add repositories with CRUD operations.
  - Generate migration (do not apply).
  - Add SSE event envelope types to packages/types.

M5B — Chat Run Service + API routes:
  - ChatRunService with full lifecycle.
  - POST /v1/chat/runs + GET .../events + POST .../cancel + GET .../
  - Cost calculation helper.
  - Tests.

M5C — Manual smoke + cleanup:
  - Apply migration.
  - End-to-end test: create run → stream events → verify persistence.
  - Decide fate of M4B POST /v1/chat/stream route.

---

Architecture constraints:

The run engine MUST:
- Create durable `chat_run` + `chat_model_run` rows BEFORE streaming.
- Persist the user message BEFORE starting the provider call.
- Persist the assistant message AFTER the provider call completes.
- Write usage ledger entries after each model run completes.
- Use transactions for atomic multi-row operations but NOT hold
  transactions open during provider streaming.
- Emit the full typed SSE event envelope with sequence numbers.
- Support idempotency keys on run creation.
- Support cancellation via a dedicated cancel endpoint.
- Gate run creation on user role (viewers cannot execute).
- Thread AbortSignal through to LLMGateway.stream().

The run engine MUST NOT:
- Store provider keys in the run rows or event payloads.
- Log plaintext provider keys at any level.
- Use floating-point arithmetic for cost calculations.
- Introduce direct provider SDK calls (all streaming via LLMGateway).
- Delete or modify the legacy useChat hook or /api/chat route (M6).
- Introduce WebSockets (SSE only for M5).

---

Strict stack compliance:

Confirm the implementation continues to use:
- pnpm / Turborepo
- Hono (API layer)
- Vercel AI SDK via @omnimind/ai gateway
- Clerk (authentication)
- Neon Postgres + Drizzle ORM
- Infisical-managed PROVIDER_KEY_ENCRYPTION_SECRET

Confirm it does NOT introduce:
- Direct provider REST/SDK calls
- Bun, Fastify, Supabase Auth, AWS, Fly.io, Railway, Temporal,
  LiteLLM, Kubernetes
- A second persistence layer for chat data
- WebSockets

---

Before editing, state your pre-implementation checklist:

  Current milestone:
  Task reading mode:
  Docs read:
  Handoffs/reviews read:
  Files inspected:
  M4B smoke status: (was the manual smoke performed?)
  Pre-flight environment status:
  Planned M5 slice: (full M5 / M5A / M5B / M5C)
  Out of scope for this session:
  Key integration points confirmed:

---

Validation:

Run all available checks before declaring M5 done:

  pnpm type-check
  pnpm lint
  pnpm test
  pnpm build

Plus the manual end-to-end smoke: create a run, stream events, verify
rows in chat_runs + chat_model_runs + messages + usage_ledger.

If the smoke cannot be run, say so explicitly.

---

Final response format:

1. Current-state assessment
2. M5 implementation plan (with sub-slices if needed)
3. M5 implementation summary
4. Files changed
5. Validation results
6. Architecture / stack compliance notes
7. M5 completion status
8. Risks / blockers
9. Recommended next task / prompt
```

---

## Recommended next step after this prompt

If the agent completes full M5, the next milestone is **M6 — Frontend Migration**:
- Add typed chat API client.
- Add `useChatRun` hook that creates runs via `POST /v1/chat/runs` and
  subscribes to events via `GET /v1/chat/runs/:runId/events`.
- Rewire the chat UI (single mode) onto backend runs.
- Reconcile streamed content with persisted messages via TanStack Query.
- Remove or feature-flag the legacy direct provider fan-out.
- Delete `apps/web/src/app/api/chat/route.ts` and legacy `useChat`.

If the agent only completed M5A (schema + repos), the next session
should finish M5B (service + routes) then M5C (smoke).
