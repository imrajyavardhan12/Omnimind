# Start M5C Live HTTP End-to-End Smoke Agent Prompt

Use this prompt when starting a new coding-agent session after M5B — Chat Run
Service + API routes has been completed, reviewed, committed, and pushed
(commit `81ac05d` on `main`).

M5C is a **verification milestone**, not a build milestone. The goal is to prove
the M5B run engine works end-to-end over real HTTP against real Neon and a real
provider, then record the result. Expect little-to-no production code: at most
small bug fixes if the smoke surfaces a defect. Do NOT add features.

---

```txt
We have completed, reviewed, committed, and pushed OmniMind v2 M0 through M5B.

The authoritative milestone sequence is:
M4B — Gateway API + SSE         ✅ done
M5A — Run engine schema + repos ✅ done
M5B — Chat Run Service + routes ✅ done (committed 81ac05d, pushed)
M5C — Live HTTP end-to-end smoke ← current
M6  — Frontend Migration        (rewire UI onto backend runs)
M7  — File Pipeline
M8  — Council Mode v2
M9  — Observability / Cost Controls / Hardening

We are now starting M5C — the live HTTP end-to-end smoke of the M5B run engine.

Use Task Mode from @AGENTS.md (M5 is an active milestone; M5A/M5B established the
schema, service, and routes). Escalate to Bootstrap Mode only if the repository
state is unclear.

Read these first:

@AGENTS.md
@docs/handoff-m5b.md
@docs/architecture/09-streaming-protocol.md
@docs/architecture/11-api-design.md

Skim if needed:

@docs/handoff-m5a.md
@docs/architecture/07-backend-architecture.md
@docs/architecture/14-security.md

---

What already exists (DO NOT rebuild):

  Routes (apps/api/src/routes/chat-runs.ts), wired under v1 at /v1/chat/runs:
    POST   /v1/chat/runs              create run (role-gated, idempotent)
    GET    /v1/chat/runs/:runId/events  SSE: replay persisted + live, ?afterSequence=N
    POST   /v1/chat/runs/:runId/cancel cancel a run
    GET    /v1/chat/runs/:runId        run detail + model runs

  Service: apps/api/src/services/chat-run.service.ts (ChatRunService orchestrator)
  Live transport: apps/api/src/services/run-coordinator.ts (in-process, single instance)
  Atomic writes: packages/db/src/repositories/chat-run-write.repository.ts (db.batch)

  Migrations 0002 + 0003 are APPLIED to Neon; model_catalog is seeded (17 models).
  The db.batch FK-ordering was already verified live against Neon in M5B.

  What was NOT verified in M5B (this is the entire point of M5C):
    The full HTTP path through real Clerk auth + a real provider streaming call.
    M5B's tests mock the gateway, the repos, and auth. No real provider token was
    ever exchanged; no real Clerk session was ever verified by the middleware.

---

Environment contracts you must respect (already in code — do not change):

  apps/api env (packages/config/src/index.ts, parsed from process.env):
    PORT                            default 3001
    ALLOWED_ORIGIN                  default http://localhost:3000  (Clerk authorizedParties)
    CLERK_SECRET_KEY                required
    PROVIDER_KEY_ENCRYPTION_SECRET  required, min 64 chars
    DATABASE_URL                    required (Neon)
  Values live in apps/api/.env.local (already present). Do NOT print secrets,
  do NOT commit them, do NOT paste them into the handoff.

  Auth (apps/api/src/middleware/auth.ts):
    Every /v1 route requires header `Authorization: Bearer <clerk session token>`.
    The token is verified via Clerk verifyToken with authorizedParties=[ALLOWED_ORIGIN],
    so its `azp` claim must match ALLOWED_ORIGIN. Missing/invalid -> 401 UNAUTHENTICATED.
    workspace.ts then upserts the app_user from Clerk and resolves the default
    workspace + role (findOrCreateDefault defaults role to 'owner').

  Public provider enum (packages/types provider-keys.ts):
    openai | anthropic | gemini | openrouter | google-ai-studio
  Provider-key upsert:  PUT /v1/provider-keys/:provider   body { "key": "<secret>" }
    (the body field is `key`, NOT `apiKey`; route reads parsed.data.key.
     PUT/DELETE require owner/admin role; GET returns metadata only, no plaintext.)
  Create-run body (createRunRequestSchema):
    {
      "conversationId": "<uuid>",
      "input": { "text": "..." },
      "models": [ { "provider": "openai", "model": "gpt-4o-mini", "settings": { "maxOutputTokens": 64 } } ],
      "context": { "messageLimit": 20 }
    }
  Idempotency-Key is an HTTP header, not a body field.

  Use provider `openai` with a model that exists in the seed AND has a registered
  gateway adapter. Seeded openai models: gpt-4o, gpt-4o-mini, o1, o1-mini.
  Prefer `gpt-4o-mini` with a tiny maxOutputTokens (e.g. 64) to keep the real
  call cheap. (Avoid o1/o1-mini for the smoke — reasoning models have different
  streaming/temperature behavior; gpt-4o-mini is the clean happy-path choice.)
  The gateway adapter registry (packages/ai adapter-registry.ts) maps openai,
  anthropic, gemini, google-ai-studio, openrouter — so `openai` is supported.

---

Pre-flight checklist (confirm ALL before smoking):

1. On main at >= 81ac05d, working tree clean: `git log --oneline -1 && git status`.
2. `pnpm install`, then `pnpm type-check`, `pnpm test`, `pnpm build` all green on HEAD.
3. Neon reachable and seeded: confirm model_catalog has rows and the 4 run-engine
   tables exist (chat_runs, chat_model_runs, chat_run_events, usage_ledger).
   A quick check script can `select count(*) from model_catalog`.
4. You can mint a real Clerk session token whose azp == ALLOWED_ORIGIN.
   Options, easiest first:
     a. Run apps/web (pnpm dev:web), sign in, and in the browser console call
        `await window.Clerk.session.getToken()` — copy that JWT.
     b. Use a Clerk-issued testing/long-lived token from the Clerk dashboard for
        this instance, ensuring azp/authorizedParties line up.
   If you cannot obtain a token, STOP and report — M5C cannot proceed without it,
   and that is the documented M5B blocker, not a code defect.
5. You have a real provider API key for `openai` (BYOK) to save into the workspace.
   If you cannot obtain one, STOP and report — same reasoning.

If step 4 or 5 cannot be satisfied in this environment, do NOT fake them. Record
exactly which precondition was missing and stop; that is a legitimate M5C outcome.

---

Task:

1. Boot apps/api locally:  `cd apps/api && sfw pnpm dev`  (listens on PORT, default 3001).
   Keep it running; tail its logs in a second shell to watch run lifecycle logging.

2. Establish auth: export the Clerk token once, e.g. `TOKEN=<jwt>`. Every curl below
   sends `-H "Authorization: Bearer $TOKEN"`. A first sanity call:
     GET /v1/models  -> expect 200 with the seeded catalog (proves auth + workspace + DB).

3. Save a provider key (server-side encrypt path):
     PUT /v1/provider-keys/openai   body { "key": "<real-openai-key>" }  -> 200
     GET /v1/provider-keys          -> the key appears with a keyHint (last 4), NO plaintext.

4. Create a conversation (the run needs a real conversationId in the workspace):
     POST /v1/conversations  body { "title": "M5C smoke", "mode": "single" } -> 201, capture id.

5. Happy path — create a run with an Idempotency-Key:
     POST /v1/chat/runs
       -H "Idempotency-Key: <uuid-A>"
       body { conversationId, input:{text:"Say hello in 5 words."},
              models:[{provider:"openai",model:"gpt-4o-mini",settings:{maxOutputTokens:64}}] }
     -> 201 { runId, conversationId, eventStreamUrl }. Capture runId.

6. Subscribe and watch the stream:
     GET /v1/chat/runs/:runId/events     (curl -N for unbuffered SSE)
     Expect, in order: run.started -> model.started -> model.delta (>=1)
       -> model.completed -> usage.updated -> run.completed.
     Sequence numbers must be strictly monotonic. If the run already finished before
     you subscribed, you must still see the full sequence replayed from chat_run_events
     (this is the create-then-subscribe guarantee) and the stream should then close.

7. Verify persistence (one query script against Neon, by runId):
     - chat_runs:        status=completed, started_at/completed_at set, input_message_id set.
     - chat_model_runs:  status=completed, output_message_id set, input/output/total_tokens,
                         cost_usd, latency_ms populated, usage_source='provider'.
     - messages:         a user row (the prompt) and an assistant row (model_run_id set,
                         contentText = the streamed text).
     - chat_run_events:  the full envelope sequence, unique per (chat_run_id, sequence).
     - usage_ledger:     one row for the model run with matching tokens + cost_usd.

8. Idempotency dedup — replay the SAME create call with the SAME Idempotency-Key (uuid-A):
     -> 200 (not 201), SAME runId, and NO new chat_runs/messages rows created.

9. Cancellation — start a fresh run (new Idempotency-Key uuid-B) with a longer prompt,
   then quickly:
     POST /v1/chat/runs/:runId/cancel  -> { "status": "cancelled" }
   On the event stream expect model.cancelled then run.cancelled; in the DB the run and
   the in-flight model run end 'cancelled'. (Timing-sensitive: if the run completes before
   the cancel lands, note it and retry with a longer prompt / smaller model.)

10. Role gating (if feasible): with a viewer-role token, POST /v1/chat/runs -> 403 FORBIDDEN.
    If you only have an owner token, note role gating as covered-by-unit-tests, not live.

11. Negative path (cheap, no provider call needed): create a run for a model NOT in the
    catalog (e.g. model:"does-not-exist") and confirm the model run fails (model.failed +
    chat_model_runs.error_code set) while the run resolves to failed — proves the
    partial-failure path persists.

Throughout: confirm provider keys never appear in any response body, SSE payload,
chat_run_events.payload_json, or server logs (14-security.md). Spot-check the api logs
and the persisted event rows.

Cleanup: the smoke writes real rows. Either run it against a disposable workspace, or
delete the smoke rows afterward in FK-safe order (usage_ledger -> chat_model_runs ->
chat_run_events -> chat_runs -> messages -> conversations). Do not delete the provider
key if the workspace is reused. Do not truncate shared tables.

---

M4B decision to confirm (not change yet):
  POST /v1/chat/stream still exists and is kept until M6. M5C does not remove it.

---

If the smoke surfaces a real bug:
  Fix it minimally, add/adjust a unit test that would have caught it, re-run
  pnpm type-check/test/build, and note it in the handoff. Do not expand scope.

---

Validation (must pass before declaring M5C done):
  pnpm type-check
  pnpm lint
  pnpm test
  pnpm build
  PLUS the live smoke steps 5-11 above actually executed against real HTTP, with
  the persistence in step 7 verified by querying Neon.

---

Final response format:
1. Current-state assessment (commit, clean tree, checks green)
2. Pre-flight results (Neon reachable? Clerk token obtained? provider key obtained?)
3. Smoke execution log (each step: request -> observed status/events -> pass/fail)
4. Persistence verification (the 5-table check, by runId)
5. Idempotency + cancellation + negative-path results
6. Any bugs found and fixes made (with tests)
7. Secret-leak spot-check result
8. Cleanup performed
9. M5C completion status (DONE / BLOCKED-with-reason)
10. Recommended next task (M6) or remaining gaps
```

---

## If M5C is BLOCKED (no Clerk token or no provider key in this environment)

That is an acceptable outcome and the documented M5B blocker. In that case the agent
should:
- Confirm everything verifiable WITHOUT credentials (checks green, Neon reachable,
  catalog seeded, tables present, `GET /v1/models` shape if a token is available).
- State exactly which precondition was missing.
- Recommend running the smoke locally where a Clerk session and a real provider key
  are available, then proceed to M6 (which exercises the same path through real UI and
  will provide equivalent end-to-end coverage).

## Recommended next step after M5C

M6 — Frontend Migration:
- features/chat/api/chatApi.ts typed client for POST /v1/chat/runs + GET /:runId/events.
- useChatRun hook: create runs, subscribe to SSE, reconcile streamed deltas with
  persisted messages via TanStack Query.
- Rewire single-mode chat UI onto backend runs.
- Delete legacy useChat, apps/web/src/app/api/chat/route.ts, and the M4B
  POST /v1/chat/stream route.
