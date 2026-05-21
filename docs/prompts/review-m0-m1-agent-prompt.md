# M0/M1 Review Coding-Agent Prompt

Use this prompt when starting a new coding-agent session after M0 and M1 have been completed, before beginning M2.

---

```txt
We have completed OmniMind v2 M0 and M1. Before starting M2, perform a thorough review of the completed work.

Use Bootstrap Mode from @AGENTS.md because this is a new session and we need to re-establish current project state.

Read these first:

@AGENTS.md
@docs/README.md
@docs/master-rebuild-plan.md
@docs/agent-execution-playbook.md
@docs/architecture/04-technology-stack.md
@docs/architecture/05-monorepo-structure.md
@docs/architecture/07-backend-architecture.md
@docs/architecture/10-data-model.md
@docs/architecture/11-api-design.md
@docs/architecture/18-roadmap.md
@docs/architecture/20-engineering-standards.md
@docs/adr/0001-dedicated-backend-orchestrator.md
@docs/adr/0005-postgres-primary-store.md
@docs/adr/0006-definitive-v2-platform-stack.md

Also find and read the M0 and M1 handoff files. They may be named something like:

- handoff-m0.md
- handoffm1.md
- docs/handoff-m0.md
- docs/handoff-m1.md
- docs/handoffs/*

If you cannot find the handoff files, state that clearly and continue by inspecting the repository.

Task:
Perform a thorough review/audit of the M0 and M1 implementation. Do not implement M2 yet.

Review goals:
1. Verify M0 was completed correctly.
2. Verify M1 was completed correctly.
3. Identify blockers before starting M2 Provider Key Vault.
4. Identify architectural drift from the docs.
5. Identify missing validation, tests, migrations, or scripts.
6. Produce a clear review report with required fixes and recommended next steps.

M0 expected scope:
- pnpm + Turborepo established.
- Legacy Bun workflow removed or clearly marked as legacy.
- Existing Next.js app preserved as `apps/web` if migration happened.
- `apps/api` exists with a health endpoint.
- `apps/worker` exists as a skeleton.
- `packages/types` exists.
- `packages/config` exists with environment validation skeleton.
- `packages/db` exists as the Drizzle/DB skeleton.
- `packages/ai` exists as the future LLM Gateway skeleton.
- `packages/telemetry` exists.
- `packages/ui` exists.
- Root scripts exist for `dev`, `build`, `type-check`, `lint`, and `test` through pnpm/Turborepo.
- No chat/auth/provider behavior was unnecessarily migrated in M0.

M1 expected scope:
- Clerk authentication integration started/implemented according to the plan.
- Neon Postgres/Drizzle setup exists.
- Initial schema exists for:
  - `app_users`
  - `workspaces`
  - `workspace_members`
  - `conversations`
  - `messages`
- Migrations exist or migration generation/config is clearly set up.
- Database client exists.
- Repository layer exists or there is a clear service/repository boundary.
- API has conversation/message endpoints according to the docs.
- API resolves Clerk user to internal user/workspace context.
- Workspace authorization is considered/enforced for M1 resources.
- Frontend API client/TanStack Query setup exists if in M1 scope.
- Existing localStorage sessions are not destroyed without migration/import path.

Strict stack compliance:
Confirm the implementation uses the chosen v2 stack:
- pnpm
- Turborepo
- Next.js on Vercel-compatible `apps/web`
- Hono for API
- Render-compatible API/worker structure
- Clerk for auth
- Neon Postgres
- Drizzle ORM
- Upstash Redis only where needed
- Cloudflare R2 only where needed
- Infisical for secrets plan/config

Confirm it does NOT introduce forbidden/default-non-choice stack items:
- Bun as v2 package manager
- Fastify
- Supabase Auth as v2 auth
- Supabase Postgres as v2 production DB
- AWS as default infra
- Fly.io or Railway as default API host
- Temporal
- LiteLLM as primary provider abstraction
- Kubernetes

Inspection requirements:
- Inspect package/workspace files.
- Inspect apps and packages structure.
- Inspect API entrypoints/routes.
- Inspect DB schema/migrations/client.
- Inspect auth/workspace code.
- Inspect frontend migration points if any.
- Inspect handoff files.
- Inspect root scripts.
- Inspect docs only if implementation diverged.

Validation:
Run available checks if dependencies are installed or can be installed safely:

```txt
pnpm install
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

If a command cannot be run, explain exactly why.

Do not make code changes during the initial review unless you find tiny documentation/link issues and explicitly state them. Prefer producing the review report first.

Final response format:

1. Current milestone assessment
   - M0 status: Pass / Partial / Fail
   - M1 status: Pass / Partial / Fail
   - Ready for M2: Yes / No

2. Files and handoffs reviewed

3. M0 checklist results
   - item-by-item pass/fail notes

4. M1 checklist results
   - item-by-item pass/fail notes

5. Architecture/stack compliance
   - compliant items
   - violations or concerns

6. Validation results
   - commands run
   - pass/fail output summary

7. Blockers before M2
   - must fix before Provider Key Vault

8. Non-blocking follow-ups

9. Recommended next prompt/task
   - either fix blockers
   - or start M2 Provider Key Vault

Important:
Do not start M2 in this session unless explicitly asked after the review.
```

---

## Recommended next step after this review

If the review says M0/M1 are ready, start M2 with a separate prompt focused only on Provider Key Vault.

If the review finds blockers, fix blockers before starting M2.
