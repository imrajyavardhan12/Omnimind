Phase/Milestone: M5B — Chat Run Service + API routes (single-model, sequential) (2026-05-29)

Summary:
M5B adds the Chat Run Service (the chat orchestrator) and the create-then-subscribe
chat run API on top of the M5A schema/repos/types/cost foundation. A user prompt now
creates a durable chat_run + chat_model_run(s), persists the user message, streams the
provider response via the M4A LLM Gateway, emits typed SSE envelopes with monotonic
per-run sequence numbers (persisted to chat_run_events for replay), persists the
assistant message, and writes a usage_ledger entry with decimal-safe cost. Runs support
idempotency keys, cancellation, role gating (viewers cannot execute), and partial
failure.

Migrations 0002 (model_catalog) and 0003 (run engine) are now APPLIED to Neon and the
model catalog is seeded (17 models) — this clears the M4B/M5A smoke blocker.

Files changed:

  packages/db
    NEW   src/repositories/chat-run-write.repository.ts   ChatRunWriteRepository:
            createRunSetup() + completeModelRun() — atomic multi-table writes via db.batch()
    UPD   src/index.ts                                    export ChatRunWriteRepository
            + ChatModelRunCompletionFields

  apps/api
    NEW   src/services/run-coordinator.ts                 RunCoordinator: in-process
            EventEmitter pub/sub keyed by runId + AbortController registry (single instance)
    NEW   src/services/chat-run.service.ts                ChatRunService (orchestrator):
            startRun / getRun / cancelRun + detached executeRun lifecycle; ChatRunServiceError
    NEW   src/services/__tests__/chat-run.service.test.ts 6 tests (happy path, idempotency
            dedup, partial failure -> run completed, all-fail -> run failed, cancellation,
            conversation-not-found)
    NEW   src/services/__tests__/run-coordinator.test.ts  6 tests (pub/sub delivery, run
            isolation, unsubscribe, register+abort signal, abort unknown run, finish)
    NEW   src/routes/chat-runs.ts                         POST /, GET /:runId/events (SSE
            replay+live), POST /:runId/cancel, GET /:runId
    NEW   src/routes/__tests__/chat-runs.test.ts          13 tests (validation, viewer 403,
            create 201, idempotency 200, 404; events terminal-replay + afterSequence + 404 +
            LIVE non-terminal subscribe/dedupe/terminal-break; cancel; detail + 404)
    UPD   src/index.ts                                    construct shared RunCoordinator,
            wire v1.route('/chat/runs', ...)

  docs
    NEW   docs/handoff-m5b.md                             this file

Validation (after code-review fixes):
  - pnpm type-check (turbo) : PASS (9/9 packages)
  - pnpm lint      (turbo)  : PASS (no warnings or errors)
  - pnpm test      (turbo)  : PASS (104 tests: 37 @omnimind/ai, 37 @omnimind/api,
                              23 @omnimind/db, 7 @omnimind/web) — +38 vs M5A
  - pnpm build     (turbo)  : PASS (api tsc + web next build)

Code review (high-effort, 7 angles) — 4 findings fixed:
  1. buildMessages dropped the current prompt for conversations >200 messages.
     MessageRepository.findByConversation orders ASC LIMIT 200 (oldest 200), so
     the just-persisted prompt was excluded once a conversation passed 200 msgs.
     Fix: new MessageRepository.findRecentByConversation (DESC LIMIT n, reversed
     to chronological) — newest N always included at the DB level. buildMessages
     uses it. (+4 message.repository tests)
  2. Retrying a FAILED run, or a concurrent double-submit, with the same
     Idempotency-Key threw a UNIQUE violation -> 500 and burned the key.
     Fix: failed-run retry now releases the old run's key
     (ChatRunRepository.releaseIdempotencyKey -> NULL, audit-preserving) so the
     retry can claim it; createRunSetup is wrapped so a concurrent insert that
     loses the race (SQLSTATE 23505, detected via new @omnimind/db
     isUniqueViolation helper) re-fetches and returns the winning run as a dedup.
     (+5 errors tests, +3 service tests)
  3. SSE replay loop ignored `closed`, writing to a disconnected client until a
     write threw. Fix: `if (closed) break` at the top of the replay loop.
  4. An orphaned `running` run (API restarted mid-run, in-process coordinator
     state lost) made GET /events block forever on heartbeats. Fix: when the
     queue is empty and `coordinator.isActive(runId)` is false, close the stream
     — nothing more can arrive on this instance. The publish-before-finish()
     ordering guarantees a true terminal event is queued before isActive flips,
     so this never drops the terminal event. (+1 route test)

Migration / seed status (PRE-FLIGHT — now done):
  - drizzle-kit migrate applied 0002 + 0003 to Neon: SUCCESS.
  - db:seed seeded model_catalog: 17 models.
  - Verified live: tables chat_runs, chat_model_runs, chat_run_events, usage_ledger,
    model_catalog all present; indexes present incl. UNIQUE chat_run_events_run_sequence_idx
    and UNIQUE chat_runs_idempotency_key_idx.

Live batch integration check (against real Neon, NOT a provider call):
  A throwaway integration script exercised ChatRunWriteRepository against Neon with real
  fixtures (app_user + workspace + conversation). Both batches committed and the FK links
  resolved within a single batch: chat_runs.input_message_id == user message id;
  chat_model_runs.output_message_id == assistant message id; chat_model_run status/cost;
  usage_ledger row + tokens; 2 messages persisted. RESULT: PASS. All fixtures torn down
  (no orphan rows). This confirms the db.batch() FK-ordering the unit tests mock out.

Key design decisions:

  1. Transactions via db.batch (NOT db.transaction).
     The DB client uses drizzle-orm/neon-http, whose driver THROWS
     "No transactions support in neon-http driver" for interactive
     db.transaction(async tx => ...). It DOES support db.batch([...]), which Neon
     executes as a single atomic server-side transaction. ChatRunWriteRepository owns
     the two atomic groups and pre-generates row ids (crypto.randomUUID) so
     interdependent rows are written as independent statements in one batch:
       - createRunSetup:   [insert user message, insert chat_run(input_message_id set),
                            ...insert chat_model_runs]
       - completeModelRun: [insert assistant message, update chat_model_run(output_message_id,
                            usage/cost/latency/status), insert usage_ledger]
     Statement order satisfies FKs within the batch. We did NOT switch to neon-serverless
     (Pool/WebSocket) — the v2 stack explicitly avoids introducing WebSockets, and batch
     satisfies the "atomic multi-row ops" architectural intent. (Consider an ADR if a
     future milestone needs interactive transactions / a worker.)

  2. Transaction boundaries match 07-backend-architecture.md:
       - one batch for run setup (run + user message + model runs),
       - one batch per model completion (assistant message + model run update + usage ledger),
       - NO transaction/batch held open during provider streaming. Status transitions
         (run->running/completed/failed/cancelled, model->running/failed/cancelled) are
         single-row updates outside any batch.

  3. Live transport = in-process RunCoordinator (EventEmitter pub/sub + AbortController
     registry), single API instance only. Every event is ALSO persisted to chat_run_events,
     so GET /events replays for completed/reconnecting runs. Redis pub/sub is M9.

  4. GET /events closes the create-then-subscribe gap: subscribe to the live bus FIRST,
     then replay persisted events (?afterSequence=N), then stream live events deduped by
     sequence; a terminal run event (run.completed/failed/cancelled) or client disconnect
     ends the stream. Heartbeat every 20s. afterSequence filters replay.

  5. Run execution is detached (fire-and-forget) from the POST handler (create-then-
     subscribe). executeRun is fully guarded (try/catch/finally) and never rejects;
     unexpected errors -> chat_run failed + run.failed event. The route attaches a defensive
     no-op .catch.

  6. Client disconnect on GET /events does NOT cancel the run (the events route never
     touches the AbortController). Only POST /:runId/cancel aborts via the registry, which
     propagates AbortSignal into gateway.stream(); the detached loop then transitions
     statuses and emits model.cancelled / run.cancelled.

  7. Role gating: POST /v1/chat/runs returns 403 FORBIDDEN for userRole 'viewer'
     (14-security.md "viewer can read but not execute runs"). owner/admin/member allowed.

  8. Idempotency: Idempotency-Key header -> chat_runs.idempotency_key (per-workspace
     UNIQUE). startRun returns the existing run (HTTP 200) when a non-failed run with the
     same (workspace, key) exists; a failed run is allowed to be retried.

  9. Cost: calculateCost(inputTokens, outputTokens, model_catalog.inputCostPer1m,
     outputCostPer1m). If the model is missing from the catalog, cost defaults to
     "0.000000" and usageSource is 'estimated' when the provider omits usage totals.

M4B POST /v1/chat/stream decision:
  KEPT for now (per M5B prompt). It is the M2/M4 stateless gateway smoke path and remains
  wired + tested (7 tests). M6 (frontend migration) will remove it and the legacy useChat /
  apps/web/src/app/api/chat/route.ts once the UI is on POST /v1/chat/runs.

Architecture / stack compliance:
  - Run engine creates chat_run + chat_model_run rows BEFORE streaming; persists the user
    message BEFORE the provider call and the assistant message AFTER; writes usage_ledger
    after each model completes. (07/10/15 docs.)
  - All streaming goes through @omnimind/ai LLMGateway.stream() with AbortSignal threaded
    through; no direct provider SDK calls in apps/api.
  - Provider keys: fetched via ProviderKeyRepository.findEncrypted + decrypted via the M2
    vault helper inside the per-model scope only; never stored in run rows / event payloads,
    never logged, never returned. (14-security.md.)
  - Typed SSE envelope { type, runId, sequence, timestamp, data } from M5A
    @omnimind/types; no new stream event types introduced (09-streaming-protocol.md).
  - Stack unchanged: pnpm/Turborepo, Hono, Vercel AI SDK via @omnimind/ai, Clerk,
    Neon + Drizzle, Infisical-managed PROVIDER_KEY_ENCRYPTION_SECRET. Nothing introduced:
    no direct provider calls, Bun, Fastify, Supabase, AWS, Temporal, LiteLLM, Kubernetes,
    WebSockets, Redis pub/sub, worker queue, or a second persistence layer.
  - Audit logs: chat_run.created and chat_run.cancelled (14-security.md audit list).

Manual end-to-end HTTP smoke (M5C):
  NOT RUN in this environment. The DB-layer smoke IS done (migrations applied, catalog
  seeded, tables/indexes verified live on Neon). The full HTTP path (create run -> stream
  events -> verify rows in chat_runs + chat_model_runs + messages + chat_run_events +
  usage_ledger) requires a live Clerk session AND a real provider key row for the workspace
  (a real provider API call). Neither a Clerk session token nor a real BYOK key was
  available here. Run it for M5C:
    1. Boot apps/api + apps/web. Log in via Clerk; save an OpenAI key in settings.
    2. Create a conversation, then POST /v1/chat/runs { conversationId, input:{text}, models:[{provider:'openai',model:'gpt-4o'}] } with an Idempotency-Key header.
    3. GET /v1/chat/runs/:runId/events and confirm run.started -> model.started -> model.delta* -> model.completed -> usage.updated -> run.completed.
    4. Verify rows persisted in all five tables; re-POST with the same Idempotency-Key returns the same runId (200, no duplicate).
    5. Mid-stream POST /v1/chat/runs/:runId/cancel -> model.cancelled + run.cancelled.

Known gaps / deferred:
  - messages.modelRunId still has NO FK to chat_model_runs. M5B SETS the column on assistant
    messages (data-model intent) but defers the FK constraint (would need a migration); the
    completion batch already orders the assistant-message insert before the model-run update.
    Add the FK in a later schema change.
  - Idempotency semantics (post code-review): a key maps to one live/succeeded run; a FAILED
    run is retryable with the same key (its key is released to NULL on retry, preserving the
    failed row for audit). The UNIQUE (workspace_id, idempotency_key) index is the
    authoritative race guard — concurrent double-submits dedup to the winning run.
  - Single-instance only: RunCoordinator state (live bus + AbortControllers) is in-process.
    After an API restart, an in-flight run is left 'running' in the DB with no live loop;
    cancelRun for such a run marks it cancelled directly (best-effort, no live event). Redis
    pub/sub + durable cancellation = M9.
  - chat_run_events persistence is fire-and-forget (non-fatal) so a dropped event row cannot
    tear down an in-flight stream. Replay-after-complete is therefore best-effort under a
    tight race; acceptable single-instance.
  - Sequential model execution only (M5B). Concurrent fan-out with a concurrency limit is a
    later milestone; createRunRequestSchema already accepts up to 5 models and mode is set to
    'compare' when >1.
  - No preflight cost estimation / budget enforcement / rate limiting yet (15-cost-controls,
    M9).

M5B completion status:
  - ChatRunService / orchestrator:     COMPLETE
  - POST /v1/chat/runs:                COMPLETE (role-gated, idempotent)
  - GET /v1/chat/runs/:runId/events:   COMPLETE (replay + live + afterSequence + heartbeat)
  - POST /v1/chat/runs/:runId/cancel:  COMPLETE
  - GET /v1/chat/runs/:runId:          COMPLETE
  - Atomic writes via db.batch:        COMPLETE
  - Tests:                             COMPLETE (25 new: 6 service, 6 coordinator,
                                        13 route incl. live SSE path; 91 total pass)
  - Migrations applied + seed:         COMPLETE (Neon)
  - Manual HTTP smoke (M5C):           NOT RUN (needs Clerk session + real provider key)

Next recommended task: M6 — Frontend Migration
  - features/chat/api/chatApi.ts typed client; useChatRun (POST /v1/chat/runs + subscribe
    GET /:runId/events); rewire single-mode chat UI onto backend runs; reconcile streamed
    content with persisted messages via TanStack Query; remove legacy direct provider
    fan-out, apps/web/src/app/api/chat/route.ts, legacy useChat, and the M4B POST
    /v1/chat/stream route.
  (If you want to fully close M5C first, run the manual HTTP smoke above.)

Docs updated: docs/handoff-m5b.md (this file)
