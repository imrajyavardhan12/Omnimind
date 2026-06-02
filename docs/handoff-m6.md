Phase/Milestone: M6 — Frontend Migration to Backend Runs (single + compare) (2026-05-31)

Summary:
M6 moves the user-facing chat UI off the legacy direct-to-provider fan-out and onto
the M5 backend run engine. The composer now creates ONE backend run (POST /v1/chat/runs),
the UI subscribes to the unified SSE stream (GET /:runId/events via fetch+reader with the
Clerk bearer token), renders per-model panels keyed by modelRunId, and reconciles streamed
deltas with the persisted messages query (TanStack). The browser submits provider+model
SELECTIONS only — no provider keys, no direct provider calls. The cutover is behind a
feature flag (chatRunsEnabled, default ON) so the legacy path stays reachable and Council
mode (M8) is untouched.

The backend run contract was NOT changed (M6 is a consumer of the existing contract).

State at start: HEAD d2d3b33 (M5C), clean tree, all gates green.

---

WORK / PHASES (landed as reviewable steps):

Phase 1 — Additive foundation (zero legacy imports, breaks nothing):
  apps/web/src/features/chat/api/sseClient.ts
    - LIFTED parseSSEBuffer out of the M4B useGatewayStream hook (single source of truth).
    - readRunEventStream(response, signal?): async generator over response.body.getReader()
      yielding JSON-parsed StreamEnvelope<StreamEventType, unknown>; skips unparseable
      blocks; stops + releases reader on body end / abort.
  apps/web/src/features/chat/api/runState.ts
    - Pure, immutable reduceStreamEvent(state, env): the testable core of the stream client.
      Dedupes by sequence (non-heartbeat <= lastSequence => no-op same-ref); heartbeats are
      no-ops; per-model panel state (buffer/status/usage/cost/latency/retry/error) created on
      first reference to a modelRunId, preserving arrival order; run phase from run.* events.
    - applyOutputMessageIds (modelRunId -> outputMessageId from GET /:runId).
    - resolveModelText(persisted, buffer): the reconciliation invariant — persisted message
      if present, else transient buffer; never both, never neither.
    - isRunTerminal / RUN_TERMINAL_PHASES.
  apps/web/src/features/chat/api/chatApi.ts
    - Typed client over @omnimind/types: createRun (Idempotency-Key HEADER, not a body field),
      getRun (run + modelRuns), cancelRun ({status}), openEventStream (apiFetchRaw raw Response,
      optional ?afterSequence). DTOs (ChatRunDto/ChatModelRunDto/GetRunResponse) mirror the
      drizzle row shape returned by the route.
  apps/web/src/features/chat/hooks/useMessages.ts
    - TanStack query for GET /v1/conversations/:id/messages; messageKeys factory. Messages load
      from the API, NOT localStorage.
  apps/web/src/features/chat/hooks/useChatRun.ts
    - The streaming hook (06-frontend-architecture.md). useReducer over runState. start(): create
      run (uuid Idempotency-Key) -> dispatch 'created' -> invalidate messages (surface the just-
      persisted user prompt) -> consume the SSE stream. consume(): fetch+reader loop, dispatch each
      env, dedupe/terminal-break, bounded reconnect with ?afterSequence (2 attempts). On a terminal
      event: reconcile() = getRun -> map modelRunId->outputMessageId -> invalidate messages so the
      persisted assistant message supersedes the buffer. cancel(): POST /cancel, set phase from the
      response status, reconcile (the live stream also delivers run.cancelled). reset(): abandon via
      a monotonic run-token guard so stale loops exit. Per-model errors surface without failing the
      whole run.

Phase 2+3 — Single + Compare UI (one RunChatView handles both, behind the flag):
  apps/web/src/lib/featureFlags.ts                         chatRunsEnabled() (NEXT_PUBLIC_CHAT_RUNS, default ON)
  apps/web/src/features/chat/state/runComposerStore.ts     persisted conversation POINTER (activeConversationId —
                                                           navigation state, NOT messages) + model-selection
                                                           PREFERENCES (single + compare). Messages always load
                                                           from the API, so a refresh reloads the same conversation.
  apps/web/src/features/chat/components/RunModelPicker.tsx single dropdown / compare chips from the catalog
                                                           (useAvailableModels); annotates providers without a
                                                           server key ("— no key"); selection is NOT gated on
                                                           client keys (backend returns PROVIDER_KEY_MISSING).
  apps/web/src/features/chat/components/RunModelPanel.tsx  one model run: status badge (idle/queued/running/
                                                           retrying/completed/failed/cancelled), content via
                                                           resolveModelText + MarkdownRenderer, per-model error
                                                           block, usage/cost/latency footer.
  apps/web/src/features/chat/components/RunMessageList.tsx persisted history (user + assistant) from the API.
  apps/web/src/features/chat/components/RunComposer.tsx    textarea + send/stop; Enter-to-send.
  apps/web/src/features/chat/components/RunChatView.tsx    owns useChatRun; ensures a backend conversation on
                                                           first submit (useCreateConversation); builds the
                                                           CreateRunRequest (real settings: temperature +
                                                           maxOutputTokens from the settings store, NOT 64);
                                                           reconciles history vs live panels (a live panel is
                                                           hidden once its outputMessageId appears in history —
                                                           no double render); single = 1 panel, compare = N-panel grid.
  apps/web/src/app/chat/page.tsx                           flag-gated: single + compare render RunChatView when
                                                           chatRunsEnabled(); legacy SingleChatInterface / compare
                                                           grid + AnimatedUnifiedInput kept behind the flag.
                                                           Council always legacy (M8).

Phase 4 — Safe deletions (grepped callers first; rewired/none):
  DELETED apps/api/src/routes/chat-stream.ts               M4B POST /v1/chat/stream (the M4B-decision payoff)
  DELETED apps/api/src/routes/__tests__/chat-stream.test.ts
  DELETED apps/web/src/features/chat/hooks/useGatewayStream.ts  dead after lifting parseSSEBuffer (no importers)
  UPDATED apps/api/src/index.ts                            removed the createChatStreamRouter import + the
                                                           v1.route('/chat/stream', ...) wiring.
  REPOINTED test: features/chat/hooks/__tests__/parseSSEBuffer.test.ts  ->
                  features/chat/api/__tests__/sseClient.test.ts (imports from sseClient; extended).

---

TESTS ADDED/UPDATED (vitest; web runs node env, *.test.ts only):
  features/chat/api/__tests__/sseClient.test.ts   11 — parseSSEBuffer (7, repointed) + readRunEventStream
                                                       (chunk-boundary reassembly, skip-garbage, body-less,
                                                       pre-aborted signal).
  features/chat/api/__tests__/runState.test.ts    14 — run.started, sequence dedup (same-ref), heartbeat no-op,
                                                       delta accumulation + completed usage/cost, model arrival
                                                       order, PARTIAL FAILURE ISOLATION (one model failed, others
                                                       complete, run still completed), retry status, cancelled,
                                                       run.failed error, applyOutputMessageIds, resolveModelText
                                                       (persisted-wins / empty-persisted / buffer-fallback).
  features/chat/api/__tests__/chatApi.test.ts      6 — createRun sends Idempotency-Key HEADER (not body) +
                                                       bearer + JSON body; ApiError code on non-2xx; openEventStream
                                                       GET + ?afterSequence; cancelRun POST; getRun shape.
  RESULT: web 31 passed (was 7). api 29 passed (chat-stream's 8 removed with the route).

VALIDATION GATE (pnpm, turbo):
  pnpm type-check : PASS (9/9)
  pnpm lint       : PASS (web clean)
  pnpm test       : PASS (120 total — web 31, api 29, ai 37, db 23)
  pnpm build      : PASS (web 11/11 pages, api tsc)

CODE REVIEW (high effort, 7 angles) — 5 findings fixed before push:
  1. Feature-flag off-switch was a likely no-op in the browser: chatRunsEnabled() read
     process.env['NEXT_PUBLIC_CHAT_RUNS'] (bracket), which Next.js does not reliably inline ->
     NEXT_PUBLIC_CHAT_RUNS=0 couldn't disable the flag. Fixed: dot access process.env.NEXT_PUBLIC_CHAT_RUNS
     (type-checks; noPropertyAccessFromIndexSignature is off).
  2. useChatRun leaked the SSE stream on unmount (no cleanup): switching single<->compare or leaving
     /chat left the consume loop + open fetch reader running. Fixed: useEffect cleanup aborts the
     controller + bumps the run-token so the loop exits.
  3. Reconciliation could double-render if getRun failed: a live panel was hidden only once its
     outputMessageId (from getRun) was in history. Fixed: RunChatView.livePanels now also falls back to a
     greedy provider+model claim for completed runs, so a failed getRun mapping can't leave both the
     streamed buffer and the persisted message visible.
  4. Silent failure + lost draft on conversation-create error: the composer cleared the textarea before
     the async submit resolved and no error surfaced. Fixed: RunComposer awaits onSubmit and clears only
     on success; RunChatView surfaces a conversation-create error banner and rethrows to preserve the draft.
  5. Compare "add a model" dropdown didn't reset (showed the just-picked model). Fixed: remount the
     add-select via a key after each add.

---

LIVE CLICK-THROUGH: NOT RUN here (requires an operator browser + Clerk sign-in; same handoff
shape as M5B->M5C). The backend + a real OpenRouter key + a dev conversation already exist from
M5C. Run it to fully close M6:
  1. pnpm dev:api + pnpm dev:web; sign in at http://localhost:3000.
  2. SINGLE: pick a model, send a prompt -> ONE run created -> tokens stream into the panel ->
     on completion the panel is replaced by the persisted assistant message (no double text) ->
     refresh: history reloads from the API (the run-composer persists only the conversation-id
     POINTER; messages come from GET /messages, never localStorage).
  3. COMPARE: add 2–3 models, ask once -> ONE run -> N panels keyed by modelRunId; a failing model
     (e.g. one with no server key) shows its own PROVIDER_KEY_MISSING error without killing the others.
     NOTE: M5B executes models SEQUENTIALLY, so panels appear one at a time as each model starts
     (not all N at submit) — a backend trait, not a UI defect (see follow-ups).
  4. CANCEL mid-stream -> Stop -> panel(s) show cancelled; refresh confirms cancelled in the DB.
  5. NETWORK TAB: only /v1/* calls (no direct provider calls); no provider key in any request/response.

---

KEY DECISIONS:
  - Build-new data/orchestration path behind a flag rather than surgically rewiring the 597-line
    animated SingleChatInterface; reuse presentational pieces (MarkdownRenderer). Matches the 06
    target feature structure and the "feature flag for incomplete migration" guardrail.
  - Conversation pointer (activeConversationId) is persisted as navigation state (a conversation id,
    NOT messages) so a refresh reloads the same conversation; messages are always server-canonical
    via useMessages. Model SELECTION preferences are persisted too (UI preference, not chat data).
  - Reconciliation invariant is render-time (resolveModelText + "hide live panel once its
    outputMessageId is in history"), so it is correct regardless of completed-vs-commit ordering.
    (Confirmed: chat-run.service emits model.completed AFTER awaiting the completion batch, so the
    persisted message is committed before the client can invalidate — no blank-panel race.)
  - modelRunId->message mapping uses GET /:runId modelRuns[].outputMessageId (MessageDto has no
    modelRunId field). No contract change.
  - SSE via fetch + response.body.getReader() (NOT EventSource) so the Clerk bearer token rides as
    a header. No new stream event types; @omnimind/types is the source of truth.

DELETIONS DEFERRED (callers still depend on the legacy path — grepped):
  - apps/web/src/app/api/chat/route.ts + apps/web/src/hooks/useChat.ts + lib/stores/chat.ts:
    still used by Council (useCouncil -> M8) and the prompt enhancer (lib/promptEnhancer/apiEnhancer.ts),
    plus the flag-OFF legacy chat path. Remove when the flag is retired AND Council/enhancer migrate.
  - apps/web/src/app/api/models/route.ts: still fetched by the legacy hooks/useDynamicModels.ts.
    Delete only after that hook is removed (features/models already uses /v1/models).

GUARDRAIL CHECK (AGENTS.md §6):
  - No provider calls / keys in React components or the browser (composer submits selections only). PASS
  - No new long-term localStorage for canonical data (messages/runs come from the API). PASS
  - Shared @omnimind/types reused for the run contract + stream events; no redefined event shapes,
    no new event types. PASS
  - Thin per-feature API client (chatApi); no scattered raw fetch in components. PASS
  - Small, reviewable phased steps; incomplete cutover behind a feature flag. PASS

KNOWN GAPS / FOLLOW-UPS:
  - Compare panels appear sequentially (backend M5B executes models one at a time); concurrent
    fan-out is a later milestone. UX nicety: render queued placeholder panels for all selected
    models at submit (match streamed modelRunId -> slot by submit order).
  - Conversation switching UI: the v2 view manages one conversation via the pointer + "New chat";
    the existing localStorage sidebar (ConversationSidebar) is NOT wired to it (M11 cleanup). A URL
    pointer (/chat?c=<id> or /chat/[conversationId]) is the natural next step for shareable reload.
  - No long-conversation virtualization (06 doc "if needed"); fine at current scale.
  - OPTIONAL (carried from M5C): convert the routing="hash" sign-in pages to catch-all
    /auth/login/[[...rest]] path routes. Not required for M6.
  - Per-model COST is rendered on completion; a pre-run cost estimate / budget UI is M9.

M6 EXIT CRITERIA (master-rebuild-plan §11):
  - Single mode uses chat runs:                    DONE (code + tests; live click-through pending operator).
  - Compare mode uses chat runs:                   DONE (one run, N modelRunId panels; sequential per M5B).
  - Frontend no longer sends provider keys:        DONE (single + compare path; Council legacy until M8).
  - Frontend no longer directly fans out:          DONE for single + compare (Council legacy until M8).
  - Per-model status / errors / cost render clearly: DONE (RunModelPanel; partial-failure isolation tested).

Next recommended task: M7 — File and Multimodal Pipeline (file tables + R2 signed upload + extraction
worker; composer uploads BEFORE run creation and submits input.attachmentIds — already accepted by
createRunRequestSchema). Or first run the M6 live click-through above to fully close M6.

Docs updated: docs/handoff-m6.md (this file)

================================================================================
ADDENDUM — M6 LIVE CLICK-THROUGH + UI HARDENING (2026-06-02)
================================================================================

The deferred live click-through (lines 135–149) was RUN with an operator browser
(Clerk sign-in) against the retained M5C OpenRouter key + Neon. It surfaced a CORS
defect that blocked run creation in the browser, plus a cluster of presentation-layer
bugs that curl + mocked-fetch tests could not see. All fixed on branch
`fix/m6-ui-hardening` (5 commits on 990e1c9). The backend run engine / data model /
gateway / SSE protocol needed ZERO changes — every fix was in the thin client or the
reused MVP presentation layer.

ENV GOTCHA (operator note): `apps/api` dev is `tsx watch src/index.ts`, which does NOT
auto-load `apps/api/.env.local` (only Next.js auto-loads env). Run the API with env loaded:
  cd apps/api && set -a && source .env.local && set +a && pnpm dev
Otherwise parseApiEnv throws on missing DATABASE_URL / CLERK_SECRET_KEY /
PROVIDER_KEY_ENCRYPTION_SECRET and the API never binds :3001. (ALLOWED_ORIGIN defaults to
http://localhost:3000, which the browser session token's azp requires — plain getToken()
works; no JWT template needed, unlike the M5C curl flow.)

FIXES (8) — branch fix/m6-ui-hardening:
 1. CORS: Idempotency-Key was missing from allowHeaders -> the browser preflight blocked
    POST /v1/chat/runs (the bug that surfaced first). Extracted CORS_ALLOW_HEADERS to
    apps/api/src/cors.ts + a regression test. (0b3c7bf)
 2. Reconciliation: computeLivePanels (pure, extracted from RunChatView, +6 tests) matches
    a live panel to its persisted message by modelRunId (EXACT) instead of a greedy
    provider+model heuristic that collided with a PRIOR turn to the same model and made
    freshly streamed text vanish on multi-turn. MessageDto.modelRunId added (the API
    already returned it via select-all). (7008289)
 3. MarkdownRenderer (reused MVP component) made streaming-grade: removed global
    Prism.highlightAll() (re-ran on every token, whole-document re-highlight + DOM thrash),
    fixed react-markdown v10 fenced-block detection (untagged blocks rendered as inline),
    removed rehypeRaw (partial-tag mid-stream + XSS surface). SHARED with Council + legacy
    SingleChatInterface — re-test Council rendering. (b6060d3)
 4. Stuck-active recovery: useChatRun.finalize() reconciles from GET /:runId when the
    stream ends WITHOUT a terminal event (orphaned run after an API restart / dropped
    fire-and-forget terminal / exhausted reconnects) -> no more infinite spinner, which
    also unblocked Enter-to-send. Run-token guarded so a superseded run cannot clobber a
    new one. (7008289)
 5. Metadata footer persistence: messages GET LEFT JOINs chat_model_runs ->
    totalTokens/costUsd/latencyMs on the assistant MessageDto; RunMessageList renders the
    footer, so tokens/cost/time no longer vanish on the live->history swap and survive a
    refresh. (b9c4106 + 954827f)
 6. Conversation list: RunConversationList (GET /v1/conversations) in the run-view header;
    selecting resets in-flight run state, THEN loads history (no stale-panel leak). Legacy
    localStorage ConversationSidebar + Export/Clear hidden in run mode (they acted on
    legacy state the run path does not use). Interim dropdown — a proper left rail is M6.5.
    (954827f)
 7. Settings wiring: response-language -> settings.systemPrompt, messages-in-context ->
    context.messageLimit — both were silently dropped on the run path. (954827f)
 8. CORS regression guard test (cors.test.ts) — see #1.

VALIDATION: type-check 9/9, lint clean, test 129 (+9: 3 cors, 6 computeLivePanels),
build 2/2 (web 11/11 pages, api tsc).

OPERATOR-VERIFIED LIVE: single happy path (stream -> persist swap, no double text),
compare (one run, N panels, sequential per M5B), partial-failure isolation (a stale
OpenRouter slug failure isolated to its own panel while GPT-4o completed), Enter-to-send
(after the stuck-active fix), metadata footer persists.
PENDING operator re-test: streaming render quality on code blocks, multi-turn no-vanish,
cancel/disconnect -> send-again race (the finalize run-token guard), response-language,
de-chrome visual, Council shared-renderer sanity.

KNOWN DATA ISSUE (NOT M6): seed OpenRouter slugs are stale -> several "(via OpenRouter)"
models return "No endpoints found" from OpenRouter (provider message, correctly isolated
to the panel). openai/gpt-4o is confirmed routable. Re-sync the catalog to current slugs
(M3 POST /v1/models/sync — not yet built) -> ticket.

NEXT: M6.5 — Frontend Foundation (bounded, BEFORE M7). Clean app shell + a proper
backend-wired conversation sidebar (the header dropdown here is interim), the streaming
renderer as a deliberately-owned component, retire the single/compare legacy dual-path,
and write the missing frontend architecture/standards doc — the frontend never received
the rigor the backend did, which is why all 8 of these bugs were presentation-layer. Then
dogfood the core before sequencing M7/M8/M9 by real usage rather than the fixed plan order.

Docs updated: docs/handoff-m6.md (this addendum)
