Phase/Milestone: M4B — Gateway API route + SSE + thin web hook (2026-05-27)

Summary:
`POST /v1/chat/stream` exists in apps/api as a Hono route that validates the
request body via `gatewayRequestSchema`, fetches the encrypted provider key via
`ProviderKeyRepository.findEncrypted`, decrypts it server-side via the M2
`decryptProviderKey` helper, constructs an `LLMGateway` instance from
`@omnimind/ai`, and pipes `gateway.stream()` chunks into an SSE response using
Hono's `streamSSE` helper. The `AbortSignal` from the incoming request is
threaded into the gateway so client disconnects cancel upstream provider calls.

On the frontend, `useGatewayStream` in `apps/web/src/features/chat/hooks/`
provides a `{ start, cancel, state }` API that uses `apiFetchRaw` from
`@/lib/api/client` (shared URL + auth header logic) + `ReadableStream` to
consume the SSE endpoint. It parses SSE events manually (EventSource cannot
POST), accumulates delta text, and surfaces final usage and errors. User-
initiated `cancel()` sets status to `error` with code `CANCELLED` so
downstream UI can distinguish cancellation from normal completion. The legacy
`useChat` hook and `apps/web/src/app/api/chat/route.ts` are untouched — M5
will migrate onto this hook.

Files changed:

  apps/api
    NEW   src/routes/chat-stream.ts                            POST /v1/chat/stream SSE route
    NEW   src/routes/__tests__/chat-stream.test.ts             7 tests (validation, empty body, key missing, SSE happy path, error events, abort signal, audit log)
    NEW   vitest.config.ts                                     vitest runner config
    UPD   src/index.ts                                         wire /chat/stream under v1 router
    UPD   package.json                                         added @omnimind/ai, vitest, test script

  apps/web
    NEW   src/features/chat/hooks/useGatewayStream.ts          SSE streaming hook + parseSSEBuffer (uses apiFetchRaw)
    NEW   src/features/chat/hooks/__tests__/parseSSEBuffer.test.ts  7 tests (SSE parser)
    NEW   vitest.config.ts                                     vitest runner config (with @/ path alias)
    UPD   src/lib/api/client.ts                                extracted apiFetchRaw for raw Response access; apiFetch delegates to it
    UPD   package.json                                         added vitest, test script

Validation:
  - `pnpm install`             : OK
  - `pnpm type-check` (turbo)  : PASS (9/9 packages)
  - `pnpm lint` (turbo)        : PASS (no warnings or errors)
  - `pnpm test`  (turbo)       : PASS (41/41 tests: 27 @omnimind/ai, 7 @omnimind/api, 7 @omnimind/web)
  - `pnpm build` (turbo)       : PASS (api + web production builds)

Manual end-to-end smoke:
  NOT YET PERFORMED. Requires:
  1. Migration 0002 (model_catalog) applied to Neon: `cd packages/db && sfw pnpm db:migrate`
  2. Model catalog seed applied: `cd packages/db && sfw pnpm db:seed`
  3. A real provider key row (e.g., OpenAI) saved through the settings UI.
  4. A running Clerk session.
  Without these, POST /v1/chat/stream will return MODEL_NOT_FOUND from the
  gateway's model catalog validation. The smoke must be completed before M4B
  is declared fully done.

Architecture / stack compliance:
  - SSE via Hono's `streamSSE` helper from `hono/streaming`.
  - Provider key fetched via `ProviderKeyRepository.findEncrypted(workspaceId, provider)`,
    decrypted via `decryptProviderKey(encoded, PROVIDER_KEY_ENCRYPTION_SECRET)`.
    Plaintext key is a local `const` — never assigned to context, never logged,
    never in any response.
  - `AbortSignal` from `c.req.raw.signal` threaded through to `gateway.stream()`.
    Abort propagation in tests is verified at the "signal is passed" level
    (Hono's `app.request()` test helper does not simulate real HTTP signal
    lifecycle); true cancellation behavior must be verified in the manual smoke.
  - No persistence writes: no user messages, assistant messages, conversation rows,
    or run rows created. Deferred to M5.
  - No usage ledger writes. Deferred to M6.
  - Audit log entry `chat.stream.requested` written on stream open (fire-and-forget).
  - Legacy `useChat` hook and `apps/web/src/app/api/chat/route.ts` untouched.
  - No direct provider SDK calls in apps/api or apps/web.
  - No EventSource (uses fetch + ReadableStream + manual SSE parsing).
  - Frontend hook uses `apiFetchRaw` from shared `@/lib/api/client` — no
    duplicated URL or auth header logic.
  - Stack: pnpm/Turborepo, Hono, Vercel AI SDK via @omnimind/ai, Clerk,
    Neon+Drizzle, Infisical-managed PROVIDER_KEY_ENCRYPTION_SECRET.
  - Nothing introduced: no Bun, Fastify, Supabase, AWS, LiteLLM, Kubernetes.

Response headers on SSE stream:
  Content-Type: text/event-stream
  Transfer-Encoding: chunked
  Cache-Control: no-cache, no-transform
  Connection: keep-alive
  X-Accel-Buffering: no

SSE event format:
  event: <chunk.type>   (delta | done | error)
  data: <JSON.stringify(chunk)>
  <blank line>

Pre-stream JSON error responses:
  - 400 VALIDATION_ERROR:    body fails gatewayRequestSchema
  - 400 PROVIDER_KEY_MISSING: no key row for the workspace+provider

M4B completion status:
  - API route:           COMPLETE
  - Web hook:            COMPLETE
  - Route tests:         COMPLETE (7 tests)
  - SSE parser tests:    COMPLETE (7 tests)
  - Manual smoke:        BLOCKED (migration 0002 + seed must be applied first)

Deferred follow-ups (not in M4B scope):
  - Role-based access control on the stream endpoint: 14-security.md says
    "viewer can read but not execute runs." The route currently does not gate
    on userRole. Should be addressed in M5 when proper run creation is added.
  - The `useGatewayStream` hook is not wired into any UI component yet.
    M5 will migrate the chat UI to use it.

Risks / follow-ups:
  - Migration 0002 and model_catalog seed may not be applied to Neon yet.
    This blocks the manual smoke and any real provider calls. Must be applied
    before declaring M4B fully done.
  - Hono's `streamSSE` sets `Cache-Control: no-cache` internally; the route
    overrides it to `no-cache, no-transform` by setting the header on the
    response object after `streamSSE` returns. Verified in tests.
  - turbo warns "no output files found for task X#test" — cosmetic; turbo.json
    doesn't declare `outputs` for test tasks. Not blocking.

Next recommended task: Manual end-to-end smoke, then M5 — Chat Run Engine
  1. Apply migration 0002 and seed: `cd packages/db && sfw pnpm db:migrate && sfw pnpm db:seed`
  2. Boot apps/api + apps/web locally.
  3. Log in via Clerk, save an OpenAI key through settings.
  4. curl or temp debug page: POST /v1/chat/stream with a test message.
  5. Confirm SSE deltas arrive and a `done` event closes with usage.
  6. Once confirmed, M4 is fully closed. Begin M5.

M5 — Chat Run Engine scope:
  - Add `chat_runs`, `chat_model_runs`, `chat_run_events` tables.
  - Migrate `POST /v1/chat/stream` to create run rows and persist user/assistant messages.
  - Add role-based gating (no viewer execution).
  - Migrate `useChat` to call the run engine via `useGatewayStream`.
  - Wire conversation history loading into the request context.
  - Delete the legacy `apps/web/src/app/api/chat/route.ts` and legacy `useChat`.

Docs updated: docs/handoff-m4b.md (this file)
