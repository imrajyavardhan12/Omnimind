Phase/Milestone: M5C — Live HTTP end-to-end smoke of the M5B run engine (2026-05-31)

Summary:
M5C is a verification milestone (not a build milestone). It proves the M5B chat run
engine works end-to-end over REAL HTTP against REAL Neon and a REAL provider, then
records the result. The full path that M5B could only mock was exercised live:
real Clerk session auth (verifyToken), workspace resolution, server-side provider-key
vault, the LLM Gateway provider streaming call, typed SSE envelopes with monotonic
per-run sequence, atomic db.batch persistence, idempotency, cancellation, and the
partial-failure path.

RESULT: M5C DONE. The M5B run engine passed the live smoke with no run-engine defects.
One incidental web-auth bug (unrelated to the run engine, surfaced while obtaining a
Clerk token) was fixed minimally.

Environment note: provider was OpenRouter (BYOK), not OpenAI — the operator had an
OpenRouter key. provider=openrouter is a first-class adapter (createOpenRouterModel via
@ai-sdk/openai-compatible -> https://openrouter.ai/api/v1) and the seed catalog has 4
openrouter models with pricing, so cost + usage_source='provider' work identically.
Model used: openrouter / openai/gpt-4o, maxOutputTokens 64 (cost ~ $0.000115 per run).

Pre-flight (credential-free, all PASS):
  - HEAD bf40500 (>= 81ac05d), working tree clean, on main.
  - pnpm install / type-check (9/9) / lint / test (104) / build (2/2): all green.
  - Neon reachable: all 10 tables present incl. the 4 run-engine tables; model_catalog
    seeded (17 models, openai gpt-4o/gpt-4o-mini/o1/o1-mini + 4 openrouter models);
    provider_keys=0, workspaces=0, chat_runs=0 at start (clean slate).
  - Auth middleware live WITHOUT real creds: GET /v1/models no-token -> 401
    "Missing authorization token"; garbage-token -> 401 "Invalid or expired token"
    (proves verifyToken actually runs); POST /v1/chat/runs no-token -> 401.

Credentials obtained:
  - Clerk session token: minted via a Clerk JWT template named "omnimind-jwt"
    (lifetime 3600s) using window.Clerk.session.getToken({ template: 'omnimind-jwt' })
    after signing in to apps/web at http://localhost:3000. Template tokens carry no azp
    claim, so verifyToken's authorizedParties check is skipped and the token verifies.
    GET /v1/models -> 200 (17 models) confirmed token + workspace upsert + DB in one call.
  - Provider key: real OpenRouter key saved via PUT /v1/provider-keys/openrouter.

Live smoke execution log (all PASS):
  3. PUT /v1/provider-keys/openrouter -> 200. keyHint=last4 matches; response carries NO
     plaintext and NO ciphertext (only id/workspaceId/provider/keyHint/createdBy/timestamps).
     GET /v1/provider-keys -> 200, metadata only, no plaintext.
  4. POST /v1/conversations -> 201, conversationId 14e59a11… (workspace 08cd7f87…, role owner).
  5. POST /v1/chat/runs (Idempotency-Key A) -> 201 { runId b2c101bb…, eventStreamUrl }.
  6. GET /v1/chat/runs/b2c101bb…/events (SSE) -> full ordered, strictly monotonic 1..12:
       run.started(1) -> model.started(2) -> model.delta x7 (3..9, "Hello! How are you today?")
       -> model.completed(10) -> usage.updated(11) -> run.completed(12).
     PRECISION NOTE: the subscribe attached ~ms after create while the run streamed for
     ~3.5s, so this exercised the COMBINED path — run.started arrived via replay from
     chat_run_events and the rest arrived live. The ISOLATED "subscribe to an
     already-terminal run, replay all 12 from chat_run_events, then close" guarantee and
     ?afterSequence filtering were NOT isolated live here; they are covered by M5B route
     unit tests (routes/__tests__/chat-runs.test.ts: terminal-replay + afterSequence).
     [If live-closed later: re-GET the long-terminal run b2c101bb… -> all 12 replayed then
     clean close; ?afterSequence=6 -> only 7..12.]
  7. Persistence verified by runId (server endpoint + direct Neon):
       chat_runs:       status=completed, started_at+completed_at set, input_message_id set,
                        idempotencyKey=A, mode=single.
       chat_model_runs: status=completed, provider=openrouter, model=openai/gpt-4o,
                        output_message_id set, input/output/total = 14/8/22,
                        usage_source='provider', cost_usd=0.000115, latency_ms=3538,
                        error_code=null.
       messages:        user row (modelRunId null, "Say hello in 5 words.") + assistant row
                        (modelRunId = the model run, contentText "Hello! How are you today?"
                        = the streamed deltas).
       chat_run_events: 12 rows, sequence strictly monotonic 1..12, 0 duplicate (run,seq).
       usage_ledger:    1 row, chat_model_run_id = the model run, tokens 14/8/22,
                        cost_usd 0.000115 (== model run), usage_source='provider'.
  8. Idempotency dedup: replay POST with SAME Idempotency-Key A -> 200 (not 201), SAME runId,
     and exactly 1 chat_runs row carries key A (no duplicate).
  9. Cancellation: fresh run (longer prompt, maxOutputTokens 1024), POST .../cancel ~800ms in
     -> 200 {"status":"cancelled"}. Stream: run.started -> model.started -> model.cancelled
     -> run.cancelled (cancel landed before the first token — no model.delta preceded
     model.cancelled; the task does not require deltas-first). DB: chat_runs.status=cancelled,
     in-flight chat_model_run status=cancelled.
 10. Role gating: only an owner token was available, so live 403 was NOT exercised. Covered by
     M5B unit test (routes/__tests__/chat-runs.test.ts: viewer -> 403 FORBIDDEN). Not a defect.
 11. Negative path (no provider call): model "does-not-exist" -> create 201, then
     run.started -> model.started -> model.failed -> run.failed. DB: run failed,
     chat_model_run failed with error_code MODEL_NOT_FOUND ("Model openrouter/does-not-exist
     is not in the model catalog"). Proves the partial-failure path persists and the
     orchestrator validates against the catalog before calling the provider.

Secret-leak spot-check (14-security.md), all clean:
  - OpenRouter key NOT present in: PUT/GET provider-key response bodies, any captured run/SSE
    response, chat_run_events.payload_json, or apps/api server logs.
  - Clerk token NOT present in server logs.

Bug found and fixed (incidental, web-auth — NOT the M5B run engine):
  apps/web <SignIn/> and <SignUp/> were mounted on plain routes (/auth/login,
  /auth/signup) but Clerk requires a catch-all route or hash routing; the page threw
  "The <SignIn/> component is not configured correctly". This blocked obtaining a Clerk
  token (an M5C precondition), not any M5B code path.
  Fix (minimal): added routing="hash" to <SignIn/> (apps/web/src/app/auth/login/page.tsx)
  and <SignUp/> (apps/web/src/app/auth/signup/page.tsx). No catch-all file moves.
  No unit test added: this is a Clerk component config prop (no app logic to assert);
  coverage is the app rendering + sign-in succeeding live, which it now does.
  (Also: apps/web/.env.local was missing CLERK_SECRET_KEY required by clerkMiddleware;
  copied from apps/api/.env.local. Env only, not committed.)

Validation (re-run after the web fix):
  - pnpm type-check : PASS (9/9)
  - pnpm lint       : PASS (web clean)
  - pnpm test       : PASS (104 tests; web recompiled)
  - pnpm build      : PASS (web ✓ compiled, 11/11 pages; api tsc)
  PLUS the live smoke steps 5–9 and 11 executed against real HTTP with persistence
  verified by querying Neon (step 7).

Environment quirks observed (not defects):
  - Direct node→Neon egress from the sandbox was intermittently timing out (ETIMEDOUT to
    Neon's us-east-1 IPs) while the long-running API server's Neon connection stayed
    healthy. Verification queries were run via the server endpoints where possible and
    via direct Neon with in-process backoff retry otherwise.
  - Clerk template token has a 1-hour lifetime; it expired across an overnight gap, which
    only affected late verification API calls (done instead via direct Neon, no token needed).

Cleanup status:
  - Temp verification scripts (packages/db/m5c_*.mjs) removed; git tree shows only the two
    intended web edits + this doc.
  - Smoke DB rows KEPT in the dev workspace per operator decision (useful M6 UI test data):
    conversation 14e59a11…, runs b2c101bb (completed) / 6b5b2e82 (failed) / ce0ef65c +
    13aa38c3 (cancelled) and their model runs, events, ledger rows, and 2 messages. The
    OpenRouter provider key is retained for the reused workspace. If a future cleanup is
    wanted, delete in FK-safe order: usage_ledger -> chat_model_runs -> chat_run_events ->
    chat_runs -> messages -> conversations.
  - /tmp/m5c_secrets.env (held the real OpenRouter key + an expired Clerk token) deleted;
    the key remains saved server-side (encrypted) in provider_keys, so M6 needs only a
    fresh Clerk token.

M5C completion status:
  - Credential-free pre-flight:        COMPLETE (all PASS)
  - Happy path (create + SSE):         COMPLETE (PASS)
  - 5-table persistence verification:  COMPLETE (PASS)
  - Idempotency dedup:                 COMPLETE (PASS)
  - Cancellation:                      COMPLETE (PASS)
  - Negative / partial-failure path:   COMPLETE (PASS)
  - Role gating live:                  NOT LIVE (owner-only token) — unit-test covered
  - Secret-leak spot-check:            COMPLETE (clean)
  - Validation gate after fix:         COMPLETE (green)

M4B POST /v1/chat/stream: still present; M5C does not remove it (removal is M6).

Next recommended task: M6 — Frontend Migration
  - features/chat/api/chatApi.ts typed client for POST /v1/chat/runs + GET /:runId/events.
  - useChatRun hook: create runs, subscribe to SSE, reconcile streamed deltas with persisted
    messages via TanStack Query.
  - Rewire single-mode chat UI onto backend runs.
  - Delete legacy useChat, apps/web/src/app/api/chat/route.ts, and the M4B POST
    /v1/chat/stream route.
  - Note: the routing="hash" sign-in pages now work; M6 may instead convert them to catch-all
    routes (/auth/login/[[...rest]]/page.tsx) if path-based routing is preferred for the UI.

Docs updated: docs/handoff-m5c.md (this file)
