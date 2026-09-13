# OmniMind — Ask once. Compare intelligently. Trust what happened.

OmniMind is an open-source, multi-model AI workspace. Chat with OpenAI, Anthropic,
Google Gemini, and OpenRouter models side by side — single, compare, and council
workflows — through one durable backend run engine with usage and cost accounting.

> **Status (Sept 2026):** v2 rebuild is mid-flight. M0–M6.5 are on `main`
> (backend chat runs + clean run-view UI). M7 file pipeline is landing in slices
> (M7A schema + `/v1/files/*` APIs in review; R2 wiring next). See
> [`docs/master-rebuild-plan.md`](docs/master-rebuild-plan.md) and the
> [`docs/handoff-*.md`](docs/) notes for the honest state.

## Why OmniMind

- **One run, many models** — every prompt creates a durable `chat_run` with one
  `chat_model_run` per model. Partial failure is normal: one model can fail while
  others complete.
- **Backend owns orchestration** — the frontend creates runs and subscribes to one
  typed SSE stream. No provider keys in the browser, no frontend fan-out.
- **Normalized gateway** — all provider calls go through an internal LLM Gateway
  (Vercel AI SDK + targeted adapters) with normalized streaming, usage, and errors.
- **Cost-accounted** — every model run writes a usage-ledger entry from
  `model_catalog` pricing. No hardcoded prices in UI code.
- **Workspace-scoped** — conversations, keys, files, usage, and audit logs all
  belong to a workspace.

## Architecture

```txt
Cloudflare (CDN/WAF)
  ├── apps/web  (Next.js App Router — renders server state, subscribes to SSE)
  └── apps/api  (Hono — auth, validation, chat orchestrator, SSE, file APIs)
        ├── packages/ai       (LLM Gateway: adapters, normalization, cost)
        ├── packages/db       (Drizzle schema, migrations, repositories)
        ├── packages/types    (shared Zod contracts — the source of truth)
        ├── packages/config   (env validation)
        └── packages/telemetry (logger, tracing — M9)
              Neon Postgres (system of record) · Upstash Redis (M9) · Cloudflare R2 (M7B+)
```

Key docs: [`docs/architecture/03-system-architecture.md`](docs/architecture/03-system-architecture.md) ·
[stack](docs/architecture/04-technology-stack.md) · [streaming](docs/architecture/09-streaming-protocol.md) ·
[data model](docs/architecture/10-data-model.md) · [API](docs/architecture/11-api-design.md) ·
[security](docs/architecture/14-security.md) · [ADRs](docs/adr/0006-definitive-v2-platform-stack.md).

## Quickstart (local dev)

Prereqs: Node 22+, pnpm 10.25.0, a Neon Postgres DB, Clerk keys.

```bash
pnpm install
cp .env.example apps/api/.env.local   # then fill DATABASE_URL, CLERK_*, PROVIDER_KEY_ENCRYPTION_SECRET
cp .env.example apps/web/.env.local   # then fill NEXT_PUBLIC_CLERK_*, NEXT_PUBLIC_API_URL
cd packages/db && pnpm db:migrate && pnpm db:seed
pnpm dev          # web :3000 + api :3001 via Turborepo
```

Generate the encryption secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Gates (run before every PR)

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

CI runs the same four gates on every PR. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Milestones

| Milestone | State |
|---|---|
| M0 foundation / monorepo | ✅ on main |
| M1 auth, workspace, persistence | ✅ on main |
| M2 provider key vault (AES-256-GCM) | ✅ on main |
| M3 model registry + API-backed picker | ✅ on main |
| M4 LLM Gateway (Vercel AI SDK) | ✅ on main |
| M5 chat run engine (runs, SSE, ledger) | ✅ on main |
| M6/M6.5 frontend on backend runs | ✅ on main |
| M7 file pipeline (R2 + extraction) | 🔶 M7A in review, M7B-D next |
| M8 Council Mode v2 (durable workflow) | ⬜ next after M7 |
| M9 observability, cost controls | ⬜ scoped |
| M10 launch readiness | ⬜ checklist in `docs/architecture/23-launch-checklist.md` |

## API sketch

```bash
POST /v1/chat/runs                 # Idempotency-Key header; returns runId + eventStreamUrl
GET  /v1/chat/runs/:runId/events   # text/event-stream (run.* + model.* + usage.updated)
POST /v1/chat/runs/:runId/cancel
GET  /v1/models?capability=vision  # API-backed catalog
PUT  /v1/provider-keys/:provider   # BYOK vault (plaintext never returned)
POST /v1/files/uploads             # M7A: validated, stub URL until R2 lands in M7B
```

## Security model

- Provider keys are AES-256-GCM encrypted server-side; only fingerprints reach the browser.
- Every route is workspace-scoped; viewers can read but not execute runs.
- Files live in private R2 buckets behind short-expiry signed URLs (M7B).
- Never commit `.env.local`. Report vulnerabilities per [SECURITY.md](SECURITY.md).

## Contributing

Small, reviewable slices off `main`, docs updated with every contract change,
handoff note per milestone (`docs/handoff-*.md`). Start with
[CONTRIBUTING.md](CONTRIBUTING.md) → [AGENTS.md](AGENTS.md) →
[docs/agent-execution-playbook.md](docs/agent-execution-playbook.md).

## License

MIT — see [LICENSE](LICENSE).
