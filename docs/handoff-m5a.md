Phase/Milestone: M5A — Chat Run Engine schema, repositories, types, cost helper (2026-05-27)

Summary:
M5A adds the foundational database schema, repository layer, typed SSE event
envelope, run request/response schemas, and a decimal-safe cost calculation
helper — everything the M5B Chat Run Service and API routes will build on.

No API routes, no ChatRunService, no frontend changes. Those are M5B.

Files changed:

  packages/db
    NEW   src/schema/chat-runs.ts                               chat_runs, chat_model_runs, chat_run_events tables
    NEW   src/schema/usage-ledger.ts                            usage_ledger table (append-only)
    UPD   src/schema/index.ts                                   re-export new schema modules
    NEW   src/repositories/chat-run.repository.ts               create, findById, findByIdempotencyKey, updateStatus, findByConversation
    NEW   src/repositories/chat-model-run.repository.ts         create, findById, findByChatRun, updateStatus (partial update)
    NEW   src/repositories/chat-run-event.repository.ts         create, findByChatRun (with afterSequence filter)
    NEW   src/repositories/usage-ledger.repository.ts           create, findByWorkspace (with provider/model filters)
    NEW   src/repositories/__tests__/chat-run.repository.test.ts           5 tests
    NEW   src/repositories/__tests__/chat-model-run.repository.test.ts     4 tests
    NEW   src/repositories/__tests__/chat-run-event.repository.test.ts     3 tests
    NEW   src/repositories/__tests__/usage-ledger.repository.test.ts       2 tests
    UPD   src/index.ts                                          export new repositories + types
    NEW   vitest.config.ts                                      vitest runner config
    UPD   package.json                                          added vitest, test script
    NEW   migrations/0003_ordinary_kitty_pryde.sql             migration for 4 new tables + 5 indexes (NOT applied)

  packages/types
    NEW   src/api/stream-events.ts                              StreamEnvelope, all run/model/usage/system event types + Zod schemas
    NEW   src/api/chat-runs.ts                                  createRunRequestSchema, createRunResponseSchema, status enums
    UPD   src/index.ts                                          export new chat-run + stream-event schemas/types

  packages/ai
    NEW   src/cost.ts                                           calculateCost(inputTokens, outputTokens, inputCostPer1M, outputCostPer1M) → string
    NEW   src/__tests__/cost.test.ts                            7 tests (zero, GPT-4o pricing, cheap models, large counts, fractional, no-trailing-zeros, format)
    UPD   src/index.ts                                          export calculateCost

Validation:
  - `pnpm install`             : OK
  - `pnpm type-check` (turbo)  : PASS (9/9 packages)
  - `pnpm lint` (turbo)        : PASS
  - `pnpm test` (turbo)        : PASS (66 tests: 37 @omnimind/ai, 8 @omnimind/api, 14 @omnimind/db, 7 @omnimind/web)
  - `pnpm build` (turbo)       : PASS (api + web production builds)

Migration 0003_ordinary_kitty_pryde.sql (NOT applied):
  Creates 4 tables:
    - chat_runs:        12 columns
    - chat_model_runs:  21 columns, FKs to chat_runs, workspaces, messages
    - chat_run_events:  6 columns, FK to chat_runs
    - usage_ledger:     15 columns, FKs to workspaces, app_users, conversations, chat_runs, chat_model_runs

  Indexes (per 10-data-model.md indexing strategy + integrity safeguards):
    - chat_runs_idempotency_key_idx   UNIQUE (workspace_id, idempotency_key)
    - chat_runs_conversation_idx      (conversation_id, created_at DESC)
    - chat_model_runs_chat_run_idx    (chat_run_id)
    - chat_run_events_run_sequence_idx UNIQUE (chat_run_id, sequence)  — replay ordering integrity
    - usage_ledger_workspace_idx      (workspace_id, created_at DESC)

  cost_usd is numeric(12,6) on both chat_model_runs and usage_ledger for
  consistency with model_catalog pricing columns. Returns as string in JS.

Architecture / stack compliance:
  - All new tables match 10-data-model.md entity definitions.
  - chat_runs.idempotency_key is scoped per workspace. Postgres unique index
    treats NULL as distinct, so runs without an idempotency key do not collide.
  - usage_ledger is append-only by design (no update methods on the repository).
  - SSE event envelope matches 09-streaming-protocol.md: type, runId, sequence,
    timestamp, data.
  - createRunRequestSchema accepts `models: []` array (min 1, max 5) for
    forward compatibility with compare mode. M5B will process sequentially.
  - Cost calculation uses BigInt integer arithmetic — no floating-point
    multiplication. Output is always a 6-decimal string. Token inputs are
    coerced to a safe non-negative integer (undefined/NaN/float → 0/trunc)
    so partial provider usage never throws. Decimal parsing is sign-aware.
  - Stack remains within ADR 0006: pnpm + Turborepo, Drizzle ORM, Neon Postgres.
    No new runtime dependencies introduced.

Design decisions:
  - chat_model_runs.settingsJson and chat_run_events.payloadJson use Drizzle
    jsonb() for native JSONB storage and querying.
  - Idempotency-Key will be parsed from the request header (per 11-api-design.md),
    not from the body. M5B implements this.
  - M4B POST /v1/chat/stream route is untouched. M5B will decide whether to
    keep it as an alias or remove it.

Test coverage limits:
  - Repository tests use chain-shape mocks that verify db.insert/select/update
    is called, not the actual SQL columns or WHERE clauses. Real verification
    requires applying migration 0003 and running integration tests in M5B/M5C.
  - Cost calculation tests verify arithmetic precision but do not test with
    actual model_catalog rows.

Known gaps for M5B:
  - messages.modelRunId has no FK to chat_model_runs. The data model doc says
    assistant messages should link to chat_model_runs. M5B should add this FK
    (requires a small schema change + migration).
  - No ChatRunService or API routes yet.
  - No in-process EventEmitter for live SSE streaming. M5B will add this with
    chat_run_events replay for reconnection.

M5B caller contracts (from M5A code review):
  - ChatModelRunRepository.findByConversation pagination: the cursor must be a
    valid date string; an invalid cursor now throws rather than returning a
    silently-wrong/empty result.
  - chat_run_events sequence must be unique per chat_run_id (enforced by the new
    unique index). M5B's sequence generator must allocate monotonically and not
    re-emit a sequence on retry — a duplicate will now fail the insert.

Code review findings addressed before commit:
  - Added the three performance indexes mandated by 10-data-model.md
    (chat_runs by conversation, chat_model_runs by chat_run_id, usage_ledger by
    workspace) plus a unique (chat_run_id, sequence) index on chat_run_events.
  - Hardened calculateCost against non-integer/undefined token counts and
    sign-handling in decimal parsing; added 3 regression tests.
  - Added pagination cursor validation in ChatRunRepository.findByConversation.

M4B smoke status:
  STILL BLOCKED. Migration 0002 (model_catalog) and seed have not been applied
  to Neon. Must be done before M5B manual smoke.

M5A completion status:
  - Schema:              COMPLETE
  - Repositories:        COMPLETE
  - SSE event types:     COMPLETE
  - Run request schemas: COMPLETE
  - Cost helper:         COMPLETE
  - Migration generated: COMPLETE (0003_ordinary_kitty_pryde.sql, NOT applied)
  - Tests:               COMPLETE (21 new tests)

Deferred to M5B:
  - ChatRunService / ChatOrchestrator with full run lifecycle
  - POST /v1/chat/runs (create run, return runId + eventStreamUrl)
  - GET /v1/chat/runs/:runId/events (SSE live stream + replay)
  - POST /v1/chat/runs/:runId/cancel (cancellation)
  - GET /v1/chat/runs/:runId (run detail)
  - messages.modelRunId FK to chat_model_runs
  - Role-based gating (viewers cannot create runs)
  - Integration tests with applied migration

Next recommended task: M5B — Chat Run Service + API routes
  1. Apply migrations 0002 + 0003 and seed: `cd packages/db && sfw pnpm db:migrate && sfw pnpm db:seed`
  2. Build ChatRunService in apps/api/src/services/ with the full run lifecycle.
  3. Add API routes: POST /v1/chat/runs, GET .../events, POST .../cancel, GET .../
  4. Add in-process EventEmitter for live SSE + replay from chat_run_events.
  5. Add role-based gating on run creation.
  6. Add integration tests.
  7. Manual smoke: create run → stream events → verify persistence.

Docs updated: docs/handoff-m5a.md (this file)
