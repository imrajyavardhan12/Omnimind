# Start M4B Gateway API Route & SSE Coding-Agent Prompt

Use this prompt when starting a new coding-agent session after M4A — LLM Gateway core has been completed and reviewed.

This prompt does **not** require a separate M4A code-review markdown file. The M4A code-review findings (LoadAPIKeyError classification + tools-never-forwarded regression test) were applied inline and are already in `docs/handoff-m4a.md`. If a separate review file appears later, prefer the inline handoff notes when they conflict.

---

```txt
We have completed and reviewed OmniMind v2 M0, M1, M2, M3, and M4A.

The authoritative milestone sequence is:
M3  — Model Registry     ✅ done
M4A — LLM Gateway core   ✅ done
M4B — Gateway API + SSE  ← current
M5  — Chat Run Engine    (persistence, conversation/message linkage)
M6  — Cost Accounting    (usage ledger writes)

We are now starting M4B — Gateway API route + SSE + thin web hook.

Use Task Mode from @AGENTS.md because this is a continuation of M4, not a
new major milestone. Do NOT re-read every architecture doc — read only the
ones below.

Read these first:

@AGENTS.md
@docs/handoff-m4a.md
@docs/architecture/07-backend-architecture.md
@docs/architecture/09-streaming-protocol.md
@docs/architecture/11-api-design.md
@docs/architecture/14-security.md
@docs/architecture/20-engineering-standards.md

Also skim (no need to re-read in full if you remember them):

@docs/architecture/06-frontend-architecture.md
@docs/architecture/08-llm-gateway.md

Also find and read prior handoff files (m0 through m4a). If you cannot
find one, state that clearly and continue by inspecting the repository.

---

Task:

1. Re-establish current project state after M4A.
2. Perform a brief M4A acceptance check before touching anything.
3. Confirm the two pre-flight environment requirements that M4B's
   end-to-end smoke depends on:
     a. Migration 0002 (model_catalog) and the model_catalog seed have
        been applied to Neon. (If they have not, the smoke is blocked.
        Document the gap and STOP before declaring M4B done.)
     b. `PROVIDER_KEY_ENCRYPTION_SECRET` (64-hex) is set in
        `apps/api/.env.local`, and at least one workspace has at least
        one provider key row written by the M2 vault.
4. Produce a scoped M4B implementation plan.
5. Implement the M4B slice as defined below.

Do NOT assume M4A is correct only because a handoff says it is done.
Verify the public exports of @omnimind/ai (`LLMGateway`, `LLMGatewayRequest`,
`gatewayRequestSchema`) in code before wiring them into the API route.

---

M4A readiness check (minimum):

- `packages/ai` exports `LLMGateway`, `LLMGatewayRequest`, `ProviderName`.
- `packages/types` exports `gatewayRequestSchema`, `gatewayStreamChunkSchema`,
  `GatewayError`, `GatewayStreamChunk`, `NormalizedUsage`.
- `LLMGateway.stream(request)` is an async generator that yields
  `GatewayStreamChunk` values: `delta | done | error`.
- `LLMGateway` constructor takes `{ modelCatalogService: ModelCatalogService }`.
- `apps/api/src/lib/encryption.ts` exports `decryptProviderKey(encoded, secret)`
  and is symmetric with `encryptProviderKey`.
- `ProviderKeyRepository.findEncrypted(workspaceId, provider)` is exported
  from `@omnimind/db`.
- The 27/27 gateway test suite passes (`pnpm --filter @omnimind/ai test`).

If any of these are missing or broken, fix them before proceeding.

---

M4B scope: Gateway API route + SSE + thin web hook

M4B wires the M4A gateway library into a real HTTP endpoint and a
matching frontend hook. After M4B the loop user-prompt → backend chat run
→ provider stream → frontend render exists end-to-end for a single model,
for the first time in v2.

M4B does NOT implement:
- `chat_runs` / `chat_model_runs` / `chat_run_events` tables (that is M5).
- Conversation/message linkage to runs (M5).
- Usage ledger writes (M6).
- Multi-model fan-out / compare mode (M5).
- Removal of the legacy `apps/web/src/app/api/chat/route.ts` MVP path (M5+).
- Removal of the legacy `useChat` hook (M5).
- Rate limiting / quotas / budgets (M6/M9).

If scope creep appears, stop, note it, and defer to the appropriate milestone.

---

M4B implementation targets:

apps/api:
- Add `POST /v1/chat/stream` route. The route must:
  1. Validate the request body with `gatewayRequestSchema` from
     `@omnimind/types`. On failure return JSON 400 with the standard
     `{ error: { code: 'VALIDATION_ERROR', message, requestId } }` shape.
  2. Resolve the workspace via the existing `createWorkspaceMiddleware`
     (already mounted on the `/v1` router). Do NOT bypass workspace
     scoping — the provider key lookup MUST be workspace-scoped.
  3. Fetch the encrypted provider key via
     `new ProviderKeyRepository(db).findEncrypted(workspaceId, provider)`.
     If absent, respond JSON 400 with code `PROVIDER_KEY_MISSING` —
     do NOT open the SSE stream.
  4. Decrypt the key with `decryptProviderKey(encrypted, env.PROVIDER_KEY_ENCRYPTION_SECRET)`.
     The plaintext key must live only as a local variable for the duration
     of the request — never assigned to context, never logged, never
     returned in any response.
  5. Construct `new LLMGateway({ modelCatalogService: new ModelCatalogService(db) })`.
     A per-request construction is fine for M4B; pooling can come later.
  6. Open an SSE response with:
       Content-Type: text/event-stream
       Cache-Control: no-cache, no-transform
       Connection: keep-alive
       X-Accel-Buffering: no       # disables proxy buffering at Cloudflare/nginx
  7. Iterate `gateway.stream({ ...body, providerKey, abortSignal })` and emit
     one SSE event per chunk:
       event: <chunk.type>             # delta | done | error
       data: <JSON.stringify(chunk)>
       <blank line>
     Flush after each event (Hono's `stream()` helper handles this).
  8. Thread `c.req.raw.signal` (Web Standard AbortSignal) into
     `gateway.stream(...)` so a client disconnect cancels the upstream
     provider call. Cancellation will surface back through the gateway
     as an `error` chunk with code `CANCELLED`.
  9. Audit-log a `chat.stream.requested` entry on stream open via
     `AuditLogRepository`. M5 will replace this with proper chat_run row
     creation; the audit log is sufficient observability for M4B.
  10. Never write the user message or the assistant response to
      `conversations` / `messages` tables — that linkage is M5. M4B
      streams without persisting; restart safety comes in M5.
- Wire the route under `v1.route('/chat/stream', createChatStreamRouter(db, env.PROVIDER_KEY_ENCRYPTION_SECRET))`
  in `apps/api/src/index.ts`.

apps/web:
- Add `useGatewayStream` under `src/features/chat/hooks/useGatewayStream.ts`.
  The hook should:
  - Accept `{ provider, model, messages, system?, temperature?, maxOutputTokens? }`.
  - Use the existing `apiFetch` client (Clerk Bearer token already attached)
    — DO NOT roll a new fetch wrapper.
  - Parse the SSE response stream manually with `response.body.getReader()`
    + a `TextDecoder` + a line buffer (EventSource does not support POST
    so it is unusable here). Parse `event:` / `data:` pairs.
  - Expose `{ start(request), cancel(), state }` where state is
    `{ status: 'idle' | 'streaming' | 'done' | 'error', text: string, usage?: NormalizedUsage, error?: GatewayError }`.
  - Use `AbortController` for the underlying fetch, and call `controller.abort()`
    from `cancel()` so the backend receives the disconnect.
- DO NOT delete the legacy `useChat` hook or the legacy
  `apps/web/src/app/api/chat/route.ts`. M5 will migrate persistence on top
  of this hook.
- DO NOT change any chat UI component yet. M4B exposes the hook;
  consumption is a manual smoke through a temporary `/debug` page or
  by importing the hook in dev tools. M5 will do the UX migration.

Tests:
- `apps/api` tests for the new route:
  - 400 on invalid body (Zod fail).
  - 400 with code `PROVIDER_KEY_MISSING` when no key row exists.
  - 200 with `Content-Type: text/event-stream` on the happy path
    (mock the `@omnimind/ai` `LLMGateway` so `gateway.stream(...)` yields
    a fixture sequence).
  - SSE `error` event surfaced when the gateway yields an error chunk.
  - Cancellation: aborting the client's request closes the response.
  - Add vitest to `apps/api` (currently no test runner); mirror the
    `packages/ai/vitest.config.ts` setup.
- `apps/web`: a light unit test of the SSE parser portion of
  `useGatewayStream` is sufficient for M4B — full hook tests require
  React Testing Library setup which can be deferred to M5.

Manual end-to-end smoke (do this before declaring M4B done):
- Boot `apps/api` and `apps/web` locally.
- Log in via Clerk; confirm a workspace exists.
- Use the settings UI to save a real OpenAI provider key (M2 stores
  encrypted server-side).
- Either through a temporary debug page or via curl with a Clerk bearer
  token, hit `POST /v1/chat/stream` with `{ provider: 'openai', model: 'gpt-4o',
  messages: [{ role: 'user', content: 'reply with exactly: hi' }] }`.
- Confirm: SSE events arrive, deltas concatenate to the expected text,
  a `done` event closes with non-zero usage. Take a screenshot or paste
  the curl output into the handoff.
- Confirm cancellation: start a long generation, cancel the curl/page,
  watch the api logs for the gateway's `CANCELLED` error chunk being
  emitted before the route closes.

If migration 0002 / seed are NOT applied, the smoke will fail with
`MODEL_NOT_FOUND` on every request. Apply them first:

  cd packages/db && sfw pnpm db:migrate && sfw pnpm db:seed

---

Suggested M4B slicing if too large for one session:

M4B-1 — API route only:
- Add `POST /v1/chat/stream` + tests; manual curl smoke.
- Defer the web hook.

M4B-2 — Web hook + manual page smoke:
- Add `useGatewayStream` + SSE parser test.
- Wire a throwaway debug page or use dev tools to drive the hook end-to-end.

---

Architecture constraints:

The route MUST:
- Use Hono's `stream()` helper (or `streamSSE()` if Hono exposes one in the
  installed version — check `node_modules/hono/dist/helper/streaming/`).
- Validate the body with `gatewayRequestSchema` from `@omnimind/types`
  — never roll a local schema.
- Resolve the provider key via `ProviderKeyRepository.findEncrypted` and
  decrypt via the M2 helper — never read env vars for provider keys,
  never accept a provider key in the request body or headers.
- Pass `c.req.raw.signal` to `gateway.stream(...)`.
- Audit-log on stream open (not on stream close — the close path may
  never be reached on client disconnect).

The route MUST NOT:
- Persist user messages, assistant messages, conversation rows, or run
  rows. That is M5.
- Write a usage ledger entry. That is M6.
- Return plaintext provider keys in any response field, even error responses.
- Log plaintext provider keys at any log level.
- Use the legacy `apps/web/src/app/api/chat/route.ts` provider code as
  a reference — that is the MVP path and contradicts v2 architecture.
- Construct provider SDK clients directly. All provider streaming must
  go through `LLMGateway` from `@omnimind/ai`.

The hook MUST:
- Use `apiFetch` (already attaches Clerk Bearer) so auth is consistent.
- Parse SSE manually (EventSource cannot POST).
- Surface cancellation via `AbortController`.

The hook MUST NOT:
- Persist conversation state to localStorage as canonical data.
- Replace `useChat` yet — leave the legacy hook in place.
- Add direct provider SDK calls (banned by AGENTS.md).

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
- Direct provider REST/SDK calls in apps/api or apps/web
- New env-var paths for provider API keys
- Bun, Fastify, Supabase Auth, Supabase Postgres, AWS, Fly.io, Railway,
  Temporal, LiteLLM, Kubernetes
- EventSource (cannot POST; use fetch + ReadableStream)
- A second persistence layer for chat in M4B

---

Before editing, state your pre-implementation checklist:

  Current milestone:
  Task reading mode:
  Docs read:
  Handoffs/reviews read:
  Files inspected:
  M4A readiness summary:
  Pre-flight environment status: (migration 0002 + seed applied? PROVIDER_KEY_ENCRYPTION_SECRET set? a test provider key row present?)
  Planned M4B slice: (full M4B / M4B-1 only / M4B-2 only)
  Out of scope for this session:
  Key integration points confirmed: (encryption.decryptProviderKey, ProviderKeyRepository.findEncrypted, LLMGateway public API, gatewayRequestSchema)

---

Validation:

Run all available checks before declaring M4B done:

  pnpm type-check
  pnpm lint
  pnpm test          # must include the new apps/api SSE tests
  pnpm build

Plus the manual end-to-end smoke described above. If the smoke cannot
be run (e.g., no provider key, no Clerk session, no Neon access), say so
explicitly — do NOT silently skip it and call M4B done.

---

Final response format:

1. Current-state assessment
   - M0–M4A status summary
   - M4A readiness: Pass / Fail (with notes)
   - Pre-flight environment: Pass / Fail (with notes)
   - Ready for M4B: Yes / No

2. M4A readiness verification
   - Gateway public API surface notes
   - Decrypt path notes
   - Blockers, if any

3. M4B implementation summary
   - Route behavior
   - Hook behavior
   - Tests added
   - Audit log entries added

4. Files changed

5. Validation results
   - type-check / lint / test / build
   - Manual end-to-end smoke result (curl/screenshot/dev-tools paste)

6. Architecture / stack compliance notes
   - Confirmed: SSE via Hono stream helper
   - Confirmed: provider key fetched via M2 vault + decrypted server-side
   - Confirmed: no plaintext key in any response or log
   - Confirmed: AbortSignal threaded through to gateway
   - Confirmed: no persistence writes (deferred to M5)
   - Confirmed: no usage ledger writes (deferred to M6)
   - Confirmed: legacy useChat + legacy /api/chat route untouched

7. M4B completion status
   - Full M4B complete / M4B-1 complete / partial
   - Remaining tasks, if any

8. Risks / blockers

9. Recommended next task / prompt
```

---

## Recommended next step after this prompt

If the agent completes the full M4B (route + hook + smoke), M4 is closed. The next milestone is **M5 — Chat Run Engine**:
- Add `chat_runs`, `chat_model_runs`, `chat_run_events` tables.
- Migrate `POST /v1/chat/stream` to create run rows and persist user/assistant messages.
- Migrate `useChat` to call the run engine via the existing `useGatewayStream` plumbing.
- Wire conversation history loading into the request context.
- Delete the legacy `apps/web/src/app/api/chat/route.ts` and the legacy `useChat` direct-provider path.

If the agent only completed M4B-1 (route only), the next session should finish M4B-2 (the `useGatewayStream` hook and manual smoke).

If the manual end-to-end smoke surfaced gateway bugs that didn't show up in the M4A mocked tests, file follow-up tasks against `packages/ai` before moving to M5 — M5 builds heavily on M4A's contract.
