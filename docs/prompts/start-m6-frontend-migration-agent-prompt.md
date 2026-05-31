# Start M6 Frontend Migration Agent Prompt

Use this prompt when starting a new coding-agent session after M5C — Live HTTP
end-to-end smoke has been completed, committed, and pushed (commit `d2d3b33` on
`main`). M5C proved the M5B run engine works end-to-end over real HTTP (real Clerk
auth + real provider streaming + 5-table persistence + idempotency + cancellation
+ partial failure), so the backend run path is trusted.

M6 is a **build milestone**. The goal is to move the user-facing chat UI off the
legacy direct-to-provider fan-out and onto the backend run engine: the composer
creates ONE backend run, the UI subscribes to the unified SSE stream, and persisted
messages reconcile streamed deltas via TanStack Query. Work in small, reviewable,
phased steps. Do NOT change the backend run contract.

---

```txt
We have completed, reviewed, committed, and pushed OmniMind v2 M0 through M5C.

The authoritative milestone sequence is:
M4B — Gateway API + SSE          ✅ done
M5A — Run engine schema + repos  ✅ done
M5B — Chat Run Service + routes  ✅ done
M5C — Live HTTP end-to-end smoke ✅ done (committed d2d3b33, pushed)
M6  — Frontend Migration         ← current (rewire UI onto backend runs)
M7  — File Pipeline
M8  — Council Mode v2
M9  — Observability / Cost Controls / Hardening

We are now starting M6 — Frontend Migration to Backend Runs.

Use Task Mode from @AGENTS.md (M6 is the active milestone; the backend run engine
exists and is verified). Escalate to Bootstrap Mode only if the repository state is
unclear.

Read these first:

@AGENTS.md
@docs/master-rebuild-plan.md            (section 11 — Milestone M6)
@docs/architecture/06-frontend-architecture.md
@docs/architecture/09-streaming-protocol.md
@docs/architecture/11-api-design.md
@docs/handoff-m5c.md                     (what was verified live + M5C learnings)

Skim if needed:

@docs/architecture/22-product-ux-principles.md
@docs/handoff-m5b.md                     (the run contract, idempotency, cancellation)
@docs/architecture/20-engineering-standards.md

---

What already exists — DO NOT rebuild, DO NOT change the contract:

  Backend run API (apps/api/src/routes/chat-runs.ts, wired at /v1/chat/runs):
    POST   /v1/chat/runs               create run (role-gated, idempotent via header)
    GET    /v1/chat/runs/:runId/events SSE: replay persisted + live, ?afterSequence=N
    POST   /v1/chat/runs/:runId/cancel cancel a run -> { "status": "cancelled" }
    GET    /v1/chat/runs/:runId        run detail + model runs

  Shared contract types (packages/types — import these, do not redefine):
    @omnimind/types
      createRunRequestSchema / CreateRunRequest      (conversationId, input{text,attachmentIds?},
                                                       models[1..5]{provider,model,settings?}, context?)
      createRunResponseSchema / CreateRunResponse     ({ runId, conversationId, eventStreamUrl })
      ChatRunStatus, ChatModelRunStatus
      StreamEnvelope<TType,TData>                     ({ type, runId, sequence, timestamp, data })
      RunStarted/RunCompleted/RunFailed/RunCancelledEvent
      ModelQueued/ModelStarted/ModelDelta/ModelRetrying/ModelCompleted/ModelFailed/ModelCancelledEvent
      UsageUpdatedEvent, StreamEventType, and the matching *Data types
      (e.g. ModelDeltaData{ modelRunId, text }, ModelCompletedData, ModelFailedData)

  Existing web infrastructure to REUSE (do not reinvent):
    apps/web/src/lib/api/client.ts
      apiFetch<T>(path,{token,...})  and  apiFetchRaw(path,{token,signal,...})  + ApiError
    apps/web/src/features/conversations/api/conversationsApi.ts   (feature-client pattern + DTOs)
    apps/web/src/features/conversations/hooks/useConversations.ts (TanStack pattern: useAuth().getToken(),
      query-key factory, useQuery/useMutation, invalidateQueries on success)
    apps/web/src/features/chat/hooks/useGatewayStream.ts
      -> contains parseSSEBuffer(buffer) and the fetch+ReadableStream reader loop.
         LIFT parseSSEBuffer (it has a unit test: features/chat/hooks/__tests__/parseSSEBuffer.test.ts)
         into the new run SSE client, then delete this M4B hook (see "Delete" below).
    apps/web/src/features/models/* and provider-keys/* (already on the v2 API — leave as-is)

  Backend is unchanged this milestone: migrations applied, model_catalog seeded (17 models,
  incl. openrouter models with pricing). A dev workspace already has a saved provider key and
  a real conversation (id 14e59a11…) with 4 runs from the M5C smoke (1 completed / 1 failed /
  2 cancelled) — useful real data to render while building.

---

M5C learnings that matter for M6 (from docs/handoff-m5c.md):

  - In-app auth uses `const { getToken } = useAuth()` from @clerk/nextjs, then
    `await getToken()` per request. The default session token is correct for the web app
    because it runs on http://localhost:3000 so its `azp` matches the API's
    authorizedParties=[ALLOWED_ORIGIN]. The JWT-template / no-azp trick from M5C was ONLY a
    curl-from-outside workaround — do NOT use it in the app.
  - apps/web/.env.local already has NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY
    (clerkMiddleware needs the secret) and NEXT_PUBLIC_API_URL defaults to :3001.
  - Sign-in pages currently use <SignIn routing="hash"/> / <SignUp routing="hash"/>. They
    work. OPTIONAL cleanup: convert to catch-all routes /auth/login/[[...rest]]/page.tsx with
    routing="path"; not required for M6.

---

Key implementation constraints (read before coding):

  1. SSE subscription MUST use fetch + response.body.getReader() (the useGatewayStream pattern),
     NOT the browser EventSource API. EventSource cannot send an Authorization header, and the
     events route requires `Authorization: Bearer <token>`. Pass the Clerk token via apiFetchRaw.
  2. Render model output keyed by modelRunId. Keep a transient buffer Record<modelRunId,string>;
     append on model.delta; set per-model status from model.queued/started/retrying/completed/
     failed/cancelled (09-streaming-protocol.md panel states). One run, N model panels.
  3. Reconcile, don't double-render. On model.completed / run.completed, invalidate the messages
     query (TanStack) so the persisted assistant message (from GET /v1/conversations/:id/messages)
     replaces the transient streamed buffer. The streamed text and the persisted contentText must
     not both show.
  4. Create-then-subscribe: POST returns { runId, eventStreamUrl }; then GET :runId/events.
     Sequence numbers are strictly monotonic — dedupe by sequence and stop on a terminal event
     (run.completed/failed/cancelled). Support ?afterSequence=N for reconnect. Single API instance:
     live events only exist on the instance that ran the run; replay from chat_run_events covers
     reconnect/refresh.
  5. Idempotency-Key is an HTTP header (generate a uuid client-side per submit, e.g.
     crypto.randomUUID()); reuse it if the same submit is retried so a network blip can't create
     a duplicate run. It is NOT a body field.
  6. The frontend must NOT send provider keys and must NOT call providers directly. The composer
     submits provider+model SELECTIONS only; keys live server-side (14-security.md).

---

Work (phased — land single mode first as a tracer, then compare):

  1. features/chat/api/chatApi.ts — typed client over @omnimind/types, following the
     conversationsApi pattern:
       chatApi.createRun(input: CreateRunRequest, idempotencyKey: string, token): CreateRunResponse
       chatApi.getRun(runId, token)            -> run detail + model runs
       chatApi.cancelRun(runId, token)         -> { status: 'cancelled' }
       chatApi.openEventStream(runId, token, { afterSequence?, signal }) -> Response (SSE, raw)
     (createRun must set the Idempotency-Key header; openEventStream uses apiFetchRaw.)

  2. SSE parsing: move parseSSEBuffer into a shared module (e.g. features/chat/api/sseClient.ts
     or lib/sse.ts) with its test; type events as StreamEnvelope<StreamEventType, …>.

  3. features/chat/hooks/useChatRun.ts — the streaming hook (06-frontend-architecture.md):
       - createRun (mutation) -> subscribe to :runId/events via fetch+reader.
       - maintain per-modelRunId buffers + statuses + run status.
       - expose cancel() -> POST :runId/cancel + abort the reader.
       - on terminal/model.completed, invalidate the conversation's messages query to reconcile.
       - surface per-model errors (ModelFailedData.error) without failing the whole run.

  4. Rewire SINGLE mode: the composer creates ONE run with models:[{one model}] and renders the
     single response panel from the stream + reconciled message. (Target per 06 doc:
     Composer -> POST /v1/chat/runs -> subscribe to unified stream.)

  5. Rewire COMPARE mode: ONE run with models:[…up to 5]; render one panel per modelRunId. Per
     06-frontend-architecture.md "Unified Chat UX": single = 1 model_run, compare = N model_runs
     in the SAME chat_run.

  6. Messages load from the API (conversationsApi.listMessages / a useMessages hook), NOT from
     localStorage. Zustand holds only draft text + UI state. Migrate the existing
     lib/stores/chat.ts usage off localStorage-as-canonical (then remove it — see Delete).

  Use a feature flag if a clean cutover isn't possible in one step (AGENTS.md prefers feature
  flags for incomplete migrations). Keep visually-useful components; rewire their data source.

---

Delete (after the new path works and nothing imports them):

  apps/web/src/hooks/useChat.ts                       legacy direct fan-out hook
  apps/web/src/app/api/chat/route.ts                  legacy Next.js BFF chat route (fan-out)
  apps/web/src/features/chat/hooks/useGatewayStream.ts M4B stateless gateway hook (after lifting parseSSEBuffer)
  apps/web/src/lib/stores/chat.ts                     localStorage canonical chat store
  apps/api/src/routes/chat-stream.ts                  M4B POST /v1/chat/stream route
    + remove its wiring in apps/api/src/index.ts (import on line ~11, v1.route on line ~49)
    + remove its tests
  apps/web/src/app/api/models/route.ts                legacy models BFF — ONLY if nothing imports it
                                                       (models already use features/models/* on the v2 API; verify first)

  Before deleting any file: grep the repo for imports of it and rewire/remove callers first.
  Removing /v1/chat/stream is the M4B-decision payoff that M5C deferred to M6 — do it here.

---

Guardrails (AGENTS.md §6):

  - No provider calls or provider keys in React components / browser.
  - No new long-term localStorage persistence for canonical data (messages, runs).
  - Reuse shared Zod types from @omnimind/types for the run contract and stream events; do not
    redefine event shapes (09-streaming-protocol.md is the source of truth — do not add event types).
  - Thin per-feature API clients (no scattered raw fetch in components).
  - Small, reviewable steps; feature-flag an incomplete cutover rather than a big-bang rewrite.
  - Update docs if any contract/behavior changes (none expected — this is a consumer of the
    existing contract).

---

Validation (must pass before declaring M6 done):

  pnpm type-check
  pnpm lint
  pnpm test            (add unit tests: chatApi request shaping, SSE parsing/dedup/terminal-break,
                        useChatRun reconciliation; keep/repoint the parseSSEBuffer test)
  pnpm build
  PLUS a live click-through in apps/web (pnpm dev:api + pnpm dev:web, sign in):
    - Single mode: type a prompt -> one run created -> tokens stream -> on completion the panel
      shows the persisted assistant message (no double text) -> refresh reloads it from the API.
    - Compare mode: 2–3 models -> one run -> N panels stream independently; one failing model
      shows its own error without killing the others.
    - Cancel mid-stream -> panel(s) show cancelled; refresh confirms cancelled in the DB.
    - Network tab: the browser calls ONLY /v1/* (no direct provider calls); no provider key
      appears in any request/response.

---

Final response format:
1. Current-state assessment (commit, clean tree, checks green)
2. Plan + phases (single tracer first, then compare), and any feature flag added
3. Files added/changed (chatApi, sseClient, useChatRun, composer/panels, messages hook)
4. Files deleted (legacy fan-out, useGatewayStream, chat-stream route + wiring) and how callers were rewired
5. Tests added/updated and results
6. Live click-through results (single, compare, cancel, no-fan-out/no-key check)
7. pnpm type-check / lint / test / build results
8. Docs updated (handoff-m6.md) and any follow-ups deferred (e.g. catch-all auth routes, virtualization)
9. M6 completion status vs the exit criteria below
10. Recommended next task (M7 — File Pipeline) or remaining gaps
```

---

## M6 exit criteria (from master-rebuild-plan.md §11)

- Single mode uses chat runs.
- Compare mode uses chat runs.
- Frontend no longer sends provider keys.
- Frontend no longer directly fans out to provider calls.
- Per-model status / errors / cost render clearly.

## Recommended next step after M6

M7 — File and Multimodal Pipeline:
- Add file tables + Cloudflare R2 signed-upload flow + extraction worker.
- Composer uploads files BEFORE run creation and submits attachmentIds with the prompt
  (createRunRequestSchema already accepts input.attachmentIds).
- LLM Gateway prepares model-specific attachment payloads. No base64 file payloads in messages.
