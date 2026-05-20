# 05 — Monorepo Structure

## Goal

The v2 rebuild should use a monorepo to separate application boundaries while sharing types, database schema, AI abstractions, telemetry, and UI primitives.

## Recommended Structure

```txt
omnimind/
  apps/
    web/
      src/
        app/
        features/
        shared/

    api/
      src/
        routes/
        middleware/
        services/
        server.ts

    worker/
      src/
        workflows/
        jobs/
        handlers/

  packages/
    ai/
      src/
        gateway/
        providers/
        model-registry/
        prompts/
        tokenization/
        errors/

    db/
      src/
        schema/
        migrations/
        repositories/
        client.ts

    types/
      src/
        api/
        chat/
        models/
        files/
        usage/

    config/
      src/
        env.ts
        constants.ts

    telemetry/
      src/
        logger.ts
        tracing.ts
        metrics.ts

    ui/
      src/
        components/
        primitives/
        styles/
```

## Apps

### `apps/web`

The Next.js frontend.

Responsibilities:

- Marketing pages.
- Auth pages.
- Chat UI.
- Settings UI.
- Dashboard UI.
- SSE client subscriptions.
- Local UI state.

Should not contain:

- Provider-specific LLM code.
- Database schema.
- Provider key encryption logic.
- Backend orchestration logic.

### `apps/api`

The API Gateway/BFF and synchronous orchestration entry point.

Responsibilities:

- HTTP routes.
- Auth middleware.
- Request validation.
- Rate limiting.
- Quota checks.
- Chat run creation.
- SSE streams.
- Conversation CRUD.
- Provider settings APIs.

### `apps/worker`

Background jobs and durable workflows.

Responsibilities:

- Council workflows.
- File extraction.
- Scheduled model sync.
- Long-running exports.
- Usage aggregation.
- Cleanup jobs.

## Packages

### `packages/ai`

Shared AI domain logic.

Contains:

- LLM Gateway interface.
- Provider adapters.
- Vercel AI SDK integrations.
- Provider-specific fallbacks.
- Token/cost calculators.
- Model registry logic.
- Prompt templates and prompt versioning.

### `packages/db`

Database layer.

Contains:

- Drizzle schema.
- Migrations.
- Repository helpers.
- Transaction utilities.
- Database client.

### `packages/types`

Shared TypeScript types and Zod schemas.

Contains:

- API request/response schemas.
- Stream event schemas.
- Domain types.
- Error contracts.

### `packages/config`

Environment and application config.

Contains:

- Environment validation.
- Shared constants.
- Provider config defaults.

### `packages/telemetry`

Shared logging/tracing/metrics.

Contains:

- Structured logger.
- OpenTelemetry setup.
- Sentry helpers.
- Redaction utilities.

### `packages/ui`

Optional shared UI library.

Useful if marketing/app/admin surfaces grow.

## Package Dependency Direction

Allowed:

```txt
apps/web    → packages/types, packages/ui, packages/config
apps/api    → packages/types, packages/db, packages/ai, packages/config, packages/telemetry
apps/worker → packages/types, packages/db, packages/ai, packages/config, packages/telemetry
packages/ai → packages/types, packages/config, packages/telemetry
packages/db → packages/types, packages/config
```

Avoid:

```txt
packages/* importing apps/*
packages/db importing packages/ai
packages/ui importing backend-only packages
```

## Required Tooling

Use exactly:

```txt
pnpm + Turborepo
```

Rules:

- `pnpm-lock.yaml` is the only v2 package lockfile.
- The legacy `bun.lock` should be removed after Phase 0 establishes pnpm.
- Root scripts should delegate to Turborepo.
- Apps and packages should expose consistent scripts: `dev`, `build`, `type-check`, `lint`, and `test` where applicable.

Do not use Bun workspaces, npm workspaces, or yarn workspaces for the v2 rebuild unless a future ADR supersedes this decision.

## Naming Convention

Use feature-first organization inside apps.

Example:

```txt
apps/web/src/features/chat/
  components/
  hooks/
  api/
  state/
  types.ts
```

Avoid large global folders where unrelated features become coupled.
