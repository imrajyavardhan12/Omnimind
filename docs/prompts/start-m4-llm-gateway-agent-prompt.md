# Start M4 LLM Gateway Coding-Agent Prompt

Use this prompt when starting a new coding-agent session after M3 Model Registry has been completed and reviewed.

This prompt does **not** require a separate M3 code-review markdown file. If no review file exists, verify M3 readiness by reading the M3 handoff and inspecting the implementation directly.

---

```txt
We have completed and reviewed OmniMind v2 M0, M1, M2, and M3.

The authoritative milestone sequence is:
M3 — Model Registry     ✅ done
M4 — LLM Gateway        ← current
M5 — Conversation Runs
M6 — Cost Accounting

We are now starting M4 — LLM Gateway.

Use Bootstrap Mode from @AGENTS.md because this is a new session and a new major milestone transition.

Read these first:

@AGENTS.md
@docs/README.md
@docs/master-rebuild-plan.md
@docs/agent-execution-playbook.md
@docs/architecture/04-technology-stack.md
@docs/architecture/07-backend-architecture.md
@docs/architecture/08-llm-gateway.md
@docs/architecture/10-data-model.md
@docs/architecture/11-api-design.md
@docs/architecture/15-cost-controls.md
@docs/architecture/18-roadmap.md
@docs/architecture/20-engineering-standards.md
@docs/adr/0004-server-side-provider-key-vault.md
@docs/adr/0005-postgres-primary-store.md
@docs/adr/0006-definitive-v2-platform-stack.md

Also find and read prior handoff files. They may be named like:

- handoff-m0.md through handoff-m3.md
- handoffm0.md through handoffm3.md
- docs/handoffs/*

If you cannot find one or more handoff files, state that clearly and continue by inspecting the repository directly.

---

Task:

1. Re-establish current project state after M0–M3.
2. Perform a brief M3 acceptance check before touching anything.
3. Confirm the two integration contracts M4 depends on are solid: M2 key-vault decrypt path and M3 model-catalog validateSelection.
4. Produce a scoped M4 implementation plan.
5. Implement the smallest safe M4 slice (M4A) as defined below.

Do not assume M3 is correct only because a handoff says it is done. Verify the important M3 boundaries in code before implementing M4.

---

M3 readiness check (minimum):

- `model_catalog` table schema and migration exist in packages/db.
- `ModelCatalogRepository` and `ModelCatalogService` are exported from packages/db.
- `ModelCatalogService.validateSelection(provider, modelId)` returns a typed result union (not a thrown exception).
- `GET /v1/models` route is wired and returns catalog entries with capability flags.
- Frontend model pickers (`ModelSelectionModal`, `ModelCommandPalette`, `CouncilModelSelector`) fetch from the API, not a static array.
- No direct provider SDK calls exist in React components or API route handlers.

If any of these are missing or broken, fix them before proceeding. M4 cannot safely build on a broken M3.

---

M4 scope: LLM Gateway

M4 introduces the gateway layer that sits between API route handlers and provider SDKs. Its job is:
1. Validate the requested model against the catalog.
2. Retrieve and decrypt the provider API key from the M2 vault.
3. Route the request to the correct provider adapter.
4. Normalize provider-specific streaming events into a single internal format.
5. Return normalized usage metrics so M6 cost accounting can consume them without knowing which provider was called.

M4 does NOT implement:
- Persistent conversation run records (that is M5).
- Cost ledger writes or billing (that is M6).
- Multi-model Council/compare routing (that is M5/M6).
- Frontend chat UI changes beyond wiring to a new API endpoint.
- Rate limiting or quota enforcement (M6).

If scope creep appears, stop, note it, and defer to the appropriate milestone.

---

M4A implementation targets (minimum viable gateway):

packages/ai (already a skeleton package):
- Define `LLMGatewayRequest` and `LLMGatewayResponse` types in packages/types.
- Implement `LLMGateway` class (or functional equivalent) in packages/ai with:
  - `stream(request: LLMGatewayRequest): AsyncIterable<GatewayStreamChunk>` method.
  - Per-provider adapters: OpenAI, Anthropic, Google AI Studio (Gemini), OpenRouter.
  - Each adapter wraps the provider's streaming SDK call and emits normalized `GatewayStreamChunk` events.
  - Normalized chunk shape: `{ type: 'delta' | 'done' | 'error', delta?: string, usage?: NormalizedUsage, error?: GatewayError }`.
- `LLMGateway` must call `ModelCatalogService.validateSelection` before constructing any provider call. Return a typed `GatewayError` with code `MODEL_NOT_FOUND` or `CAPABILITY_UNSUPPORTED` — do not throw untyped errors.
- `LLMGateway` must retrieve the provider key via the M2 decrypt helper, never from a client-supplied header or from the frontend settings store.
- Cancellation: accept an `AbortSignal` in `LLMGatewayRequest` and thread it through to the provider SDK call.

apps/api:
- Add `POST /v1/chat/stream` route that:
  - Validates the request body with a Zod schema.
  - Calls `LLMGateway.stream(...)`.
  - Writes the normalized stream as an SSE (Server-Sent Events) response.
  - Returns a typed error JSON body for any `GatewayError`.
- Wire the new route in `apps/api/src/index.ts`.

apps/web (thin integration only, not a full chat migration):
- Add a `useGatewayStream` hook in `src/features/chat/hooks/` that calls `POST /v1/chat/stream` and pipes SSE events to local state.
- Do not remove the legacy `useChat` hook. Leave it in place; M5 will migrate conversation persistence on top of the gateway.

packages/ai tests:
- Unit tests for each provider adapter: assert that a mock provider response is normalized into the expected `GatewayStreamChunk` sequence.
- Unit test for `validateSelection` rejection: assert that the gateway returns `MODEL_NOT_FOUND` for an unknown model, not a 500.
- Unit test for cancellation: assert that aborting mid-stream does not leak the provider connection.

---

Suggested M4 slicing if the full scope is too large for one session:

M4A — core gateway and adapters only (packages/ai + packages/types):
- Types, LLMGateway class, provider adapters, tests.
- No API route yet.

M4B — API route and SSE:
- `POST /v1/chat/stream` route.
- `useGatewayStream` hook.
- End-to-end manual smoke test.

---

Architecture constraints:

The gateway layer MUST:
- Use the Vercel AI SDK (`ai` package) as the streaming abstraction for provider adapters. Do not call provider HTTP APIs directly.
- Use `ModelCatalogService` from packages/db for all model validation — never inline model ID checks.
- Use the M2 AES-256-GCM decrypt path for key retrieval — never read `PROVIDER_API_KEY` env vars directly inside gateway code.
- Keep packages/ai free of HTTP framework dependencies (no Hono imports). It must be a pure library package.
- All streaming must be cancellable via `AbortSignal`.

The gateway layer MUST NOT:
- Write to the `conversations` or `messages` tables (M5 concern).
- Write usage to a cost ledger (M6 concern).
- Accept provider API keys in the request body or from a client-side store.
- Import from `apps/web` or `apps/api` — packages/ai is a shared library.

---

Strict stack compliance:

Confirm the implementation continues to use:
- pnpm / Turborepo
- Hono (API layer only)
- Vercel AI SDK (provider streaming abstraction)
- Clerk (authentication, already in place)
- Neon Postgres + Drizzle ORM (model catalog access)
- Infisical-managed secrets (M2 key vault)
- Render-compatible app/worker structure

Confirm it does NOT introduce:
- Direct provider REST calls bypassing the Vercel AI SDK
- Bun, Fastify, Supabase Auth, Supabase Postgres, AWS, Fly.io, Railway, Temporal, LiteLLM, Kubernetes
- In-process mock providers behind a feature flag (write real adapters or leave a provider unimplemented with a clear `TODO`)

---

Before editing, state your pre-implementation checklist:

  Current milestone:
  Task reading mode:
  Docs read:
  Handoffs/reviews read:
  Files inspected:
  M3 readiness summary:
  Planned M4 slice:
  Out of scope for this session:
  Key integration points confirmed: (M2 decrypt path, M3 validateSelection)

---

Validation:

Run all available checks before declaring M4 done:

  pnpm type-check
  pnpm lint
  pnpm test
  pnpm build

If a command cannot be run, explain exactly why.

---

Final response format:

1. Current-state assessment
   - M0–M3 status summary
   - M3 readiness: Pass / Fail (with notes)
   - Ready for M4: Yes / No

2. M3 readiness verification
   - Key vault decrypt path notes
   - Model catalog validateSelection notes
   - Blockers, if any

3. M4 implementation summary
   - Types added
   - Gateway class behavior
   - Provider adapters implemented
   - API route behavior
   - Hook added

4. Files changed

5. Validation results

6. Architecture / stack compliance notes
   - Confirmed: Vercel AI SDK used for adapters
   - Confirmed: M2 key vault used for key retrieval
   - Confirmed: M3 validateSelection used before provider calls
   - Confirmed: packages/ai has no HTTP framework dependency

7. M4 completion status
   - M4A complete / partial
   - Remaining M4B tasks, if any

8. Risks / blockers

9. Recommended next task / prompt
```

---

## Recommended next step after this prompt

If the agent completes M4A only, the next session should finish M4B: wire `POST /v1/chat/stream` and the `useGatewayStream` hook.

If the agent completes all of M4, the next milestone is M5 — Conversation Runs:
- Persist conversation and message records on each gateway call.
- Migrate `useChat` to go through `/v1/chat/stream`.
- Add conversation list/history API endpoints.
