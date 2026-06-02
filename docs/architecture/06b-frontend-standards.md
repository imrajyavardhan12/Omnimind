# 06b — Frontend Standards (enforced)

Companion to `06-frontend-architecture.md`. That doc describes the target; this one
is the **enforced rule set** the run-view work (M6/M6.5) actually established. The
frontend was historically the least-governed layer — every M6 hardening bug lived
here. These rules exist so it stops being that layer. Treat violations as review blockers.

## 1. Feature structure

All chat/run UI lives under a feature folder, not in scattered `components/`:

```
features/<domain>/
  api/        thin typed client over apiFetch (+ pure logic, e.g. runState.ts)
  hooks/      React Query hooks + orchestration hooks (useChatRun)
  components/ presentational + container components for this feature
  state/      Zustand stores for UI/navigation state only
```

The run view is the reference: `features/chat/{api,hooks,components,state}`.

## 2. State ownership (non-negotiable)

| State | Owner | Example |
|-------|-------|---------|
| **Server/canonical** (conversations, messages, runs, models, keys) | TanStack Query | `useMessages`, `useConversations` |
| **Streaming/transient** (per-model buffers, run phase) | a dedicated hook + pure reducer | `useChatRun` + `reduceStreamEvent` |
| **UI/navigation/draft** (selected models, active conversation id, composer text) | Zustand or local state | `runComposerStore`, `RunComposer` input |

- **DO NOT** persist canonical data (messages/runs) in `localStorage`. Only *pointers*
  (a conversation id) and *preferences* (model selections) may be persisted.
- Canonical data is always re-fetched from the API; a refresh must reload from the server.

## 3. API access

- **One thin client per feature** over `lib/api/client.ts` (`apiFetch`/`apiFetchRaw`):
  `features/<domain>/api/<domain>Api.ts`. **No raw `fetch()` in components or hooks.**
- The Clerk bearer token is attached by the client; pass `token` from `useAuth().getToken()`.
- Idempotent mutations send `Idempotency-Key` as a **header**, never a body field
  (see `chatApi.createRun`). Any new custom request header MUST be added to the API
  CORS allow-list (`apps/api/src/cors.ts`) — that gap broke run creation in M6.
- Shared `@omnimind/types` is the contract source. Don't redefine request/stream shapes.

## 4. Streaming + reconciliation (the part that bites)

- One run = `POST /v1/chat/runs` then subscribe `GET /:runId/events` via fetch+reader
  (not `EventSource` — the bearer token must ride as a header). Owned by `useChatRun`.
- The event reducer (`reduceStreamEvent`) is **pure and sequence-deduped**; keep it pure
  and unit-tested. Side effects (fetch, invalidate) live in the hook, not the reducer.
- **Reconciliation invariant:** a live panel renders the transient buffer; it is dropped
  once its persisted message is in the query cache, matched **exactly by `modelRunId`**
  (`computeLivePanels`). Never match assistant messages by `provider+model` (it collides
  across turns). Persisted supersedes buffer — never both, never neither.
- **Stream-close recovery:** if a stream ends without a terminal event, reconcile from
  `GET /:runId` and set the real phase (`useChatRun.finalize`). Never leave a run stuck
  `active`. Any post-`await` dispatch in the hook MUST be guarded by the run-token.

## 5. Rendering

- Model output is rendered through the run-owned `ChatMarkdown`
  (`features/chat/components/ChatMarkdown.tsx`), not the legacy shared shim.
- Streaming render rules (these were real bugs): **no** global `Prism.highlightAll()`
  (re-runs per token); fenced-block detection per react-markdown **v10** (language class
  or multi-line, not the removed `inline` prop); **no** `rehypeRaw` on model output
  (partial-tag rendering + XSS).
- Streaming text must not cause layout jank; keep transient buffers append-only.

## 6. Guardrails (from AGENTS.md §6 — enforced in the browser)

- **No provider calls or provider keys in the browser.** Components submit model
  *selections* only; the backend resolves keys and returns `PROVIDER_KEY_MISSING`.
- No business logic in JSX; no hidden side effects in components.
- Per-surface error handling: one model failing renders its own error and must not fail
  the run or other panels (partial-failure isolation).
- Incomplete migrations live behind a feature flag; remove the flag + the dead path when
  the migration completes (don't let two paths coexist indefinitely).

## 7. Testing

- The web suite is **node-env, `*.test.ts`, no jsdom** — so **extract pure logic** from
  components/hooks and test that (`reduceStreamEvent`, `computeLivePanels`, `parseSSEBuffer`).
- React rendering and hook timing are verified by an operator pass; don't claim them
  "done" from gates alone. State what was verified live vs. by test.

## 8. Definition of done (frontend change)

Aligns with architecture · `type-check`/`lint`/`test`/`build` green · pure logic tested ·
no canonical localStorage · no browser provider keys · contracts unchanged or `@omnimind/types`
updated · operator-verifiable behavior listed.
