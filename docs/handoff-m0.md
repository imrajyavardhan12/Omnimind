Phase/Milestone: M0 — Foundation and Monorepo Boundaries (complete, 2026-05-20)

Summary:
Migrated from a single-package Bun/Next.js repo to a pnpm 10.25.0 + Turborepo monorepo.
Existing Next.js app preserved under apps/web/. New apps/api/ skeleton with /health
endpoint proves cross-package workspace imports work end-to-end. Six shared package
skeletons created. Legacy Bun workflow removed.

Files changed:
  NEW   pnpm-workspace.yaml
  NEW   turbo.json
  MOD   package.json                   (workspace root, Turborepo scripts, pnpm config)
  MOD   .gitignore                     (monorepo paths, bun.lock gitignored)
  MOD   vercel.json                    (rootDirectory: apps/web, Bun config removed)
  MOD   .env.example                   (moved to root, unchanged)
  NEW   apps/web/package.json          (@omnimind/web, all original deps)
  MOV   apps/web/src/                  (all original Next.js source, unchanged)
  MOV   apps/web/public/               (unchanged)
  MOV   apps/web/next.config.js        (unchanged)
  MOV   apps/web/tsconfig.json         (unchanged; baseUrl/paths already relative)
  MOV   apps/web/tailwind.config.js    (unchanged; content paths already relative)
  MOV   apps/web/postcss.config.js     (unchanged)
  MOV   apps/web/components.json       (unchanged)
  MOV   apps/web/.eslintrc.json        (unchanged)
  NEW   apps/api/package.json          (@omnimind/api, Hono + tsx)
  NEW   apps/api/tsconfig.json
  NEW   apps/api/src/index.ts          (Hono server, @hono/node-server, port 3001)
  NEW   apps/api/src/routes/health.ts  (HealthResponse import from @omnimind/types)
  NEW   apps/worker/package.json       (@omnimind/worker stub)
  NEW   apps/worker/tsconfig.json
  NEW   apps/worker/src/index.ts       (stub for Phase 8 Inngest workflows)
  NEW   packages/types/...             (HealthResponse, ErrorCode, ApiError types)
  NEW   packages/config/...            (Zod env validation: apiEnvSchema, parseApiEnv)
  NEW   packages/db/...                (stub)
  NEW   packages/ai/...                (stub)
  NEW   packages/telemetry/...         (stub)
  NEW   packages/ui/...                (stub)
  DEL   bun.lock                       (replaced by pnpm-lock.yaml)

Validation:
  - pnpm type-check (turbo): 9/9 packages pass in ~2.7s
  - next lint (apps/web): no warnings or errors
  - API health endpoint: curl http://localhost:3001/health → {"status":"ok",...}
  - Cross-package imports verified: apps/api imports @omnimind/types and @omnimind/config
  - apps/web next build: FAILS during static prerendering (see Known risks below)

Known risks:
  - apps/web next build fails at static prerender because NEXT_PUBLIC_SUPABASE_URL and
    NEXT_PUBLIC_SUPABASE_ANON_KEY are not set in this environment. The Supabase client
    throws on init when these vars are absent. This is a PRE-EXISTING condition — no
    .env.local has ever been present; this would have failed identically before Phase 0.
    Compilation, type-checking, and linting all pass. The monorepo move did NOT introduce
    this failure. Resolution: M1 will replace Supabase auth with Clerk; once auth pages
    no longer call createClient() at prerender time, this failure goes away.
  - Vercel deployment needs reconfiguring: rootDirectory must be set to apps/web in the
    Vercel dashboard (vercel.json already reflects this).
  - Legacy Supabase auth in apps/web/src/ is NOT removed yet (M1 task).
  - Legacy localStorage provider keys NOT removed yet (M2 task).

Next recommended task: M1 — Auth, Workspace, and Persistence
  - Add Clerk authentication to apps/web and apps/api
  - Create Drizzle ORM schema in packages/db: app_users, workspaces,
    workspace_members, conversations, messages
  - Set up Neon Postgres and run migrations
  - Add repository layer in packages/db
  - Add conversation/message REST endpoints to apps/api
  - Add TanStack Query frontend client in apps/web
  - Remove legacy Supabase auth from apps/web/src/ once Clerk is wired

Docs updated: docs/handoff-m0.md (this file)
