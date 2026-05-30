# Start M5B Chat Run Service + API Routes Coding-Agent Prompt

Use this prompt when starting a new coding-agent session after M5A — Chat Run
Engine schema, repositories, stream event types, and cost helper has been
completed, reviewed, and committed.

---

```txt
We have completed and reviewed OmniMind v2 M0 through M5A.

The authoritative milestone sequence is:
M4B — Gateway API + SSE        ✅ done
M5A — Run engine schema + repos ✅ done (committed)
M5B — Chat Run Service + routes ← current
M5C — Manual smoke + cleanup
M6  — Frontend Migration       (rewire UI onto backend runs)
M7  — File Pipeline
M8  — Council Mode v2
M9  — Observability / Cost Controls / Hardening

We are now starting M5B — Chat Run Service + API routes.

Use Task Mode from @AGENTS.md (M5 is already an active milestone and M5A
established the schema/repo/type foundation). Escalate to Bootstrap Mode
only if the repository state is unclear.

Read these first:

@AGENTS.md
@docs/handoff-m5a.md
@docs/handoff-m4b.md
@docs/architecture/07-backend-architecture.md
@docs/architecture/09-streaming-protocol.md
@docs/architecture/11-api-design.md
@docs/architecture/14-security.md
@docs/architecture/20-engineering-standards.md

Also skim (no need to re-read in full if you remember them):

@docs/architecture/10-data-model.md
@docs/architecture/08-llm-gateway.md
@docs/architecture/15-cost-controls.md

---

What M5A already delivered (DO NOT rebuild):

  Schema (packages/db/src/schema/), migration 0003_ordinary_kitty_pryde.sql:
    - chat_runs, chat_model_runs, chat_run_events, usage_ledger
    - Indexes: chat_runs(conversation_id, created_at desc),
      chat_model_runs(chat_run_id), usage_ledger(workspace_id, created_at desc),
      UNIQUE chat_run_events(chat_run_id, sequence),
      UNIQUE chat_runs(workspace_id, idempotency_key)

  Repositories (packages/db/src/repositories/):
    - ChatRunRepository: create, findById, findByIdempotencyKey,
      updateStatus(id, status, { startedAt?, completedAt?, inputMessageId? }),
      findByConversation(conversationId, limit, cursor)
    - ChatModelRunRepository: create, findById, findByChatRun,
      updateStatus(id, status, fields?)  (partial update of tokens/cost/error/etc.)
    - ChatRunEventRepository: create, findByChatRun(chatRunId, afterSequence?)
    - UsageLedgerRepository: create (append-only), findByWorkspace(ws, filters)

  Types (packages/types/src/api/):
    - chat-runs.ts: createRunRequestSchema, createRunResponseSchema,
      chatRunModelConfigSchema, chatRunStatusSchema, chatModelRunStatusSchema
    - stream-events.ts: StreamEnvelope<TType,TData>, streamEnvelopeSchema factory,
      and per-event data schemas for run.* / model.* / usage.updated / heartbeat / error

  Cost (packages/ai/src/cost.ts):
    - calculateCost(inputTokens, outputTokens, inputCostPer1M, outputCostPer1M): string
      BigInt micro-dollar arithmetic; guards undefined/NaN/float token inputs.

  All exported from the package barrels. 66 tests pass.

---

Pre-flight checklist (must ALL be confirmed before writing code):

1. Apply migrations + seed to Neon (M5A migration 0003 and M4B-era
   migration 0002 + model_catalog seed are NOT yet applied):
     cd packages/db && sfw pnpm db:migrate && sfw pnpm db:seed
   If you cannot reach Neon, STOP and say so — M5B routes cannot be smoke-tested
   without the catalog seed (gateway returns MODEL_NOT_FOUND).
2. `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build` all pass on HEAD.
3. Confirm the M4B `POST /v1/chat/stream` route still works (M5B decides its fate).
4. Re-read the M5A caller contracts in docs/handoff-m5a.md:
   - findByConversation throws on an invalid pagination cursor.
   - chat_run_events sequence is UNIQUE per chat_run_id — the sequence
     generator must be monotonic and must not re-emit a sequence on retry.

---

Task:

1. Re-establish current project state after M5A.
2. Produce a scoped M5B implementation plan.
3. Implement M5B as defined below.

---

M5B scope: Chat Run Service + API routes (single-model, sequential)

## 1. ChatRunService / ChatOrchestrator (apps/api/src/services/)

  Encapsulate the run lifecycle. The service must:
  a. Validate idempotency key — if a run with the same (workspace, key) exists
     and is not failed, return the existing run (no duplicate).
  b. Create chat_run (status: queued).
  c. Insert the user message (role: user).
  d. Update chat_run.input_message_id.
  e. Create one chat_model_run per selected model (status: queued).
  f. Transition chat_run → running, set started_at.
  g. For each model run (sequentially for M5B; fan-out is later):
     - chat_model_run → running, set started_at.
     - Fetch + decrypt the provider key (same M4B pattern:
       ProviderKeyRepository.findEncrypted + decryptProviderKey).
     - Call LLMGateway.stream(), thread AbortSignal through.
     - Emit typed envelope events: model.started, model.delta,
       model.completed / model.failed (with monotonic sequence numbers).
     - Persist EVERY emitted event to chat_run_events (for replay/reconnect).
     - On completion: persist assistant message (role: assistant,
       model_run_id set), update chat_model_run (tokens/cost/latency/
       output_message_id), write usage_ledger entry. Use calculateCost with
       model_catalog pricing.
     - On failure: update chat_model_run error_code/error_message.
  h. After all model runs: chat_run → completed (or failed if all failed),
     set completed_at.
  i. Emit run.started and run.completed / run.failed.
  j. On cancellation (AbortSignal / cancel endpoint): transition to cancelled,
     emit model.cancelled / run.cancelled.

  Transaction boundaries:
  - One tx for (b + c + d + e) — initial run setup.
  - One tx per model completion (assistant message + model run update +
    usage ledger).
  - Do NOT hold a transaction open during provider streaming.

  Live transport: in-process EventEmitter keyed by runId (single-instance is
  acceptable for M5B; Redis pub/sub is M9). Every event is also persisted to
  chat_run_events so GET .../events can replay for completed/reconnecting runs.

## 2. API routes (apps/api/src/routes/)

  POST /v1/chat/runs
    - Validate body via createRunRequestSchema.
    - Parse Idempotency-Key header → chat_run.idempotency_key.
    - Role check: viewers CANNOT create runs (403 FORBIDDEN). owner/admin/member can.
    - Create the run via ChatRunService.
    - Return { runId, conversationId, eventStreamUrl }.

  GET /v1/chat/runs/:runId/events
    - Auth + workspace scoping (run must belong to the caller's workspace).
    - If run is terminal (completed/failed/cancelled): replay persisted
      chat_run_events.
    - If run is active: subscribe to the live EventEmitter and pipe events.
    - Support ?afterSequence=N for reconnection.
    - SSE format: event: <type>, data: <envelope JSON>, heartbeats every 15-30s.

  POST /v1/chat/runs/:runId/cancel
    - Auth + workspace scoping.
    - Abort the active provider request, mark statuses cancelled.
    - Return { status: 'cancelled' }.

  GET /v1/chat/runs/:runId
    - Auth + workspace scoping.
    - Return the run row + its model run rows.

  Wire under v1.route('/chat/runs', ...) in apps/api/src/index.ts.

  M4B POST /v1/chat/stream: KEEP for now (M6 removes it when the frontend
  migrates) OR delegate it to the run engine. Document the decision.

## 3. Tests

  - ChatRunService unit tests (mock repos + gateway):
    happy path, idempotency dedup, gateway error (model run failed but run
    completes), cancellation transitions.
  - Route tests: POST validation + role check + happy path; GET events SSE
    format + afterSequence replay; cancel transition; GET run detail.

---

Architecture constraints:

The run engine MUST:
- Create chat_run + chat_model_run rows BEFORE streaming.
- Persist the user message BEFORE the provider call; assistant message AFTER.
- Write usage_ledger after each model run completes.
- Use transactions for atomic multi-row ops, NOT during provider streaming.
- Emit the full typed envelope with monotonic per-run sequence numbers,
  and persist each event to chat_run_events.
- Support idempotency keys, cancellation, and role gating (no viewer execution).
- Thread AbortSignal through to LLMGateway.stream().

The run engine MUST NOT:
- Store provider keys in run rows or event payloads, or log them.
- Use floating-point arithmetic for cost (use calculateCost).
- Make direct provider SDK calls (all streaming via LLMGateway).
- Touch the legacy useChat hook or /api/chat route (M6).
- Introduce WebSockets, Redis pub/sub, a worker queue, or a second
  persistence layer (those are later milestones).

---

Strict stack compliance — confirm it continues to use:
  pnpm/Turborepo, Hono, Vercel AI SDK via @omnimind/ai, Clerk,
  Neon + Drizzle, Infisical-managed PROVIDER_KEY_ENCRYPTION_SECRET.
Confirm it does NOT introduce:
  Direct provider calls, Bun, Fastify, Supabase Auth, AWS, Temporal,
  LiteLLM, Kubernetes, WebSockets.

---

Before editing, state your pre-implementation checklist:

  Current milestone:
  Task reading mode:
  Docs read:
  Handoffs/reviews read:
  Files inspected:
  Migration/seed status: (were 0002/0003 + seed applied?)
  Pre-flight environment status:
  Planned scope:
  Out of scope:
  Key integration points confirmed:

---

Validation:

Run all available checks before declaring M5B done:
  pnpm type-check
  pnpm lint
  pnpm test
  pnpm build

Plus the manual end-to-end smoke (this is effectively M5C):
  Create a run → stream events → verify rows in chat_runs + chat_model_runs +
  messages + chat_run_events + usage_ledger.
If the smoke cannot be run (no Neon / no real provider key), say so explicitly.

---

Final response format:
1. Current-state assessment
2. M5B implementation plan
3. M5B implementation summary
4. Files changed
5. Validation results
6. Architecture / stack compliance notes
7. M5B completion status
8. Risks / blockers
9. Recommended next task / prompt
```

---

## Recommended next step after this prompt

If the agent completes M5B (service + routes + tests) and the manual smoke,
that effectively closes M5C too. The next milestone is **M6 — Frontend
Migration**:
- Add a typed chat API client (features/chat/api/chatApi.ts).
- Add useChatRun: create runs via POST /v1/chat/runs, subscribe via
  GET /v1/chat/runs/:runId/events.
- Rewire the chat UI (single mode) onto backend runs; reconcile streamed
  content with persisted messages via TanStack Query.
- Remove or feature-flag the legacy direct provider fan-out.
- Delete apps/web/src/app/api/chat/route.ts and legacy useChat, and the M4B
  POST /v1/chat/stream route if M5B kept it.

If the agent only gets through the service + routes but cannot smoke-test
(Neon unreachable), the next session is M5C — apply migrations, seed, and run
the end-to-end smoke.
