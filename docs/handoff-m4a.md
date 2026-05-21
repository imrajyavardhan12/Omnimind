Phase/Milestone: M4A — LLM Gateway core (complete, 2026-05-21)

Summary:
The internal LLM Gateway library exists as a pure, framework-free package.
`LLMGateway.stream()` validates the requested model against the M3 model
catalog (requiring streaming capability), routes to a per-provider adapter
backed by the Vercel AI SDK v6, and normalizes the SDK's `fullStream` parts
into the typed `delta | done | error` contract defined in @omnimind/types.
Cancellation flows from caller `AbortSignal` straight through to the
underlying SDK call. No HTTP route, no DB writes — that is M4B / M5.

Files changed:

  packages/types
    NEW   src/api/llm-gateway.ts          (gateway request/error/usage/chunk Zod schemas + types)
    UPD   src/index.ts                    (re-export gateway schemas + types)

  packages/ai
    NEW   src/gateway/types.ts            (LLMGatewayRequest with plaintext providerKey + AbortSignal — runtime-only)
    NEW   src/gateway/errors.ts           (gatewayError factory, mapAiSdkError sniffing status/name)
    NEW   src/gateway/usage.ts            (normalizeUsage: LanguageModelUsage → NormalizedUsage)
    NEW   src/gateway/adapters/openai.ts        (createOpenAI({apiKey})(modelId))
    NEW   src/gateway/adapters/anthropic.ts     (createAnthropic({apiKey})(modelId))
    NEW   src/gateway/adapters/google.ts        (createGoogleGenerativeAI — shared by gemini + google-ai-studio)
    NEW   src/gateway/adapters/openrouter.ts    (createOpenAICompatible at openrouter.ai/api/v1)
    NEW   src/gateway/adapter-registry.ts       (provider → adapter map)
    NEW   src/gateway/llm-gateway.ts            (LLMGateway class: validate → adapt → streamText → normalize)
    UPD   src/index.ts                          (public exports: LLMGateway, types, helpers)
    NEW   src/gateway/__tests__/gateway.test.ts (16 tests: validation per code, normalization
                                                 per provider, cancellation via abort part + AbortError throw,
                                                 LoadAPIKeyError → PROVIDER_AUTH_FAILED, tools-never-forwarded contract)
    NEW   src/gateway/__tests__/adapters.test.ts (6 tests: each adapter constructs + shared google identity)
    NEW   src/gateway/__tests__/usage.test.ts   (5 tests: normalization edge cases)
    NEW   vitest.config.ts
    UPD   tsconfig.json                          (Node 22 lib, DOM.AsyncIterable, @types/node)
    UPD   package.json                           (added ai@6, @ai-sdk/{openai,anthropic,google,openai-compatible},
                                                  @omnimind/db + @omnimind/types workspace deps, vitest, test scripts)

Validation:
  - `pnpm install`             : OK — 4 new SDK packages + vitest, lockfile resolved
  - `pnpm type-check` (turbo)  : PASS (9/9 packages)
  - `pnpm lint` (turbo)        : PASS (only @omnimind/web has a lint task; clean)
  - `pnpm test`  (turbo)       : PASS (27/27 tests in @omnimind/ai; no other packages have tests yet)
  - `pnpm build` (turbo)       : PASS (api + web production build)

Architecture / stack compliance:
  - Vercel AI SDK v6 (`ai` + `@ai-sdk/{openai,anthropic,google,openai-compatible}`) is the
    only streaming abstraction. No direct provider REST calls anywhere.
  - `LLMGateway.stream()` calls `ModelCatalogService.validateSelection(...,
    requiredCapabilities: { streaming: true })` before constructing any provider
    call. Returns a typed `error` chunk (never throws) for any validation
    failure (MODEL_NOT_FOUND / MODEL_DISABLED / MODEL_DEPRECATED /
    MODEL_CAPABILITY_UNSUPPORTED / MAX_OUTPUT_TOKENS_EXCEEDED).
  - Provider keys arrive as plaintext via `LLMGatewayRequest.providerKey`. The
    contract docstring locks in that the caller (apps/api in M4B) must fetch
    via `ProviderKeyRepository.findEncrypted(...)` and decrypt via the M2
    helper `decryptProviderKey(encoded, PROVIDER_KEY_ENCRYPTION_SECRET)`.
    The gateway never reads PROVIDER_API_KEY env vars and never touches the
    database for keys.
  - `packages/ai` has zero HTTP framework dependencies (no Hono import).
    Its only workspace deps are `@omnimind/db` (for ModelCatalogService) and
    `@omnimind/types` (for the cross-boundary contract types).
  - `gemini` and `google-ai-studio` share the same `createGoogleGenerativeAI`
    adapter — verified by an identity assertion in the test suite. The
    distinction lives purely in the provider-key source.
  - Stack remains within ADR 0006: pnpm + Turborepo, Hono on the API edge,
    Vercel AI SDK, Clerk, Neon + Drizzle, Infisical-managed encryption secret.
    No Bun, Fastify, AWS, Fly.io, Railway, Temporal, LiteLLM, Kubernetes,
    in-process mock providers, or feature-flagged stubs were introduced.

Normalized stream contract:
  type GatewayStreamChunk =
    | { type: 'delta'; delta: string }
    | { type: 'done'; finishReason?: string; usage?: NormalizedUsage }
    | { type: 'error'; error: GatewayError }

  Usage is end-of-stream only; deltas never carry token counts. `usage` on
  the `done` chunk is `undefined` if the provider returns no totals.
  `finish-step`, `start-step`, `text-start`/`text-end`, `reasoning-*`,
  `tool-*`, `source`, `file`, and `raw` parts are intentionally swallowed at
  M4A — extensions belong in M5+ alongside their consumers.

Known risks / follow-ups:
  - Migration 0002 (model_catalog) and the model_catalog seed are STILL
    not asserted as applied to Neon (carry-over from M3). M4A is library code
    and doesn't need them, but any end-to-end run through the gateway against
    a live DB will return MODEL_NOT_FOUND until both are applied:
      cd packages/db && sfw pnpm db:migrate && sfw pnpm db:seed
  - The `o1` / `o1-mini` seed rows have `supportsStreaming: false`. With
    M4A's mandatory `requiredCapabilities.streaming = true`, those models
    will always be rejected by the gateway. That is correct for now — M5 will
    introduce a `generate` (non-streaming) entry point that drops the
    streaming requirement so reasoning models become reachable.
  - `mapAiSdkError` sniffs `status`/`statusCode`/`name` rather than relying
    on `instanceof` checks against SDK-internal error classes. AI_LoadAPIKeyError
    and AI_LoadSettingError are explicitly handled (mapped to
    PROVIDER_AUTH_FAILED) after a code review caught the most common BYOK
    failure mode falling through to UNKNOWN_PROVIDER_ERROR. If a future AI SDK
    minor version stops setting `status` on rate-limit errors, that
    classification could still drift — worth a contract test against each
    `@ai-sdk/*` provider in M5/M6.
  - `gatewayRequestSchema` validates `messages: { role, content: string }[]`
    (text-only). Attachments / image parts / tool calls are M7+ scope and
    deliberately out of M4A.
  - No actual provider network call has been exercised. All tests mock
    `streamText` from `ai` at the seam. A first real-traffic smoke test
    belongs in M4B once `POST /v1/chat/stream` exists.
  - vitest is now a workspace dependency only of @omnimind/ai. Other
    packages will need their own `test` script + vitest dep when they grow
    test coverage; turbo's `test` task already discovers them by convention.
  - `pnpm view` and `pnpm install` both pass through Socket Firewall here;
    the firewall emits a noisy "did not detect any package fetch attempts"
    warning even on successful installs. Cosmetic.

M4 completion status:
  - M4A core gateway: COMPLETE
  - M4B remaining   : `POST /v1/chat/stream` SSE route in apps/api, a
                      `useGatewayStream` hook in apps/web that pipes SSE
                      events into local state, and one end-to-end manual
                      smoke against a real provider key.

Next recommended task: M4B — API route + SSE + thin web hook
  1. In apps/api, construct a route handler that:
     - validates the body with `gatewayRequestSchema`
     - fetches the encrypted provider key via `ProviderKeyRepository.findEncrypted(workspaceId, provider)`
     - decrypts it via `decryptProviderKey(encoded, env.PROVIDER_KEY_ENCRYPTION_SECRET)`
     - constructs `new LLMGateway({ modelCatalogService: new ModelCatalogService(db) })`
     - pipes `gateway.stream(request)` into an SSE response (one event per chunk,
       `event: <chunk.type>` + `data: <JSON.stringify(chunk)>`)
     - returns JSON `{ error: GatewayError }` with the appropriate HTTP status
       if the gateway yields a single error chunk before any deltas
     - threads `c.req.raw.signal` (or equivalent) into `gateway.stream()` so a
       client disconnect cancels the upstream provider call
  2. Wire the new route under `v1.route('/chat/stream', ...)` in apps/api/src/index.ts.
  3. In apps/web, add `useGatewayStream` under `src/features/chat/hooks/`. Use the
     Fetch API + ReadableStream to consume the SSE; DO NOT delete the legacy
     `useChat` hook (M5 will migrate conversation persistence on top of this).
  4. Manual end-to-end smoke with a real OpenAI key. After confirming, write
     handoff-m4b.md.

Docs updated: docs/handoff-m4a.md (this file)
