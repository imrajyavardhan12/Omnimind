# 04 — Technology Stack

This document defines the definitive OmniMind v2 technology stack.

For the authoritative decision record, see [ADR 0006 — Definitive OmniMind v2 Platform Stack](../adr/0006-definitive-v2-platform-stack.md).

## Final Stack Summary

```txt
Language/runtime:      TypeScript on Node.js 22 LTS
Package manager:       pnpm
Monorepo tooling:      Turborepo
Frontend:              Next.js App Router, React, Tailwind, TanStack Query, Zustand
Web hosting:           Vercel
Backend API:           Hono, TypeScript, Zod
API hosting:           Render Web Service
Worker runtime:        Render Background Worker
Workflow engine:       Inngest
Primary database:      Neon Postgres
Vector extension:      pgvector in Neon/Postgres when needed
ORM:                   Drizzle ORM
Cache/rate limits:     Upstash Redis
Object storage:        Cloudflare R2
Secrets:               Infisical
Provider key crypto:   App-level envelope encryption using keys from Infisical
Authentication:        Clerk
LLM SDK:               Vercel AI SDK behind OmniMind LLM Gateway
LLM observability:     Langfuse
App errors:            Sentry
Tracing:               OpenTelemetry
Product analytics:     PostHog
Logs:                  Axiom
Edge/DNS/WAF:          Cloudflare
```

## Service Roles

Use these exact v2 services in architecture and implementation docs:

```txt
Database            Neon Postgres
Cache/rate limits   Upstash Redis
File storage        Cloudflare R2
Secrets             Infisical
API runtime         Render Web Service
Worker runtime      Render Background Worker
Workflow engine     Inngest
Web runtime         Vercel
Edge/WAF/DNS        Cloudflare
Authentication      Clerk
```

## Frontend

### Next.js App Router

Use Next.js App Router for `apps/web`.

Reasons:

- strong React ecosystem
- excellent Vercel deployment support
- good server/client component model
- existing MVP is already built with Next.js

### TanStack Query for Server State

Use TanStack Query for canonical server-backed state:

- conversations
- messages
- runs
- model catalog
- provider key metadata
- files
- usage dashboards
- workspace settings

### Zustand for Ephemeral UI State

Use Zustand only for local UI state:

- current view mode
- sidebar visibility
- draft input state
- composer UI state
- temporary selected models before submission
- local modal state

Do not use Zustand as the canonical conversation database.

## Backend API

### Hono

Use Hono for `apps/api`.

Reasons:

- lightweight TypeScript-first API framework
- clean middleware composition
- works well in Node.js container deployments
- simple route modules for a modular monolith

Do not introduce Fastify unless a future ADR supersedes this decision.

## Package Management and Monorepo

Use:

```txt
pnpm + Turborepo
```

Rules:

- Use `pnpm-lock.yaml` as the lockfile.
- Remove legacy `bun.lock` after Phase 0 establishes pnpm.
- Root scripts should call Turborepo pipelines.
- Package-specific scripts should be consistent across apps/packages.

## AI SDK

Use the Vercel AI SDK behind the internal OmniMind LLM Gateway.

Application code should depend on OmniMind's gateway interfaces, not direct provider SDK calls.

Do not introduce LiteLLM as the primary provider abstraction in v2.

## Database

Use Neon Postgres as the primary system of record.

Use Drizzle ORM for:

- schema definitions
- migrations
- type-safe queries
- repository implementation

Use pgvector inside Neon/Postgres when vector search/RAG becomes necessary.

## Cache and Rate Limits

Use Upstash Redis.

Used for:

- rate limits
- idempotency keys
- cancellation flags
- provider health/cache state
- short-lived stream/run metadata

## Cloudflare R2

Use Cloudflare R2 for file storage.

Used for:

- uploaded files
- extracted text artifacts
- generated exports
- large attachments

Buckets must be private by default. Access should use signed URLs.

## Authentication

Use Clerk for OmniMind v2 authentication.

Clerk owns:

- user authentication
- OAuth/social login
- session management
- organization identity where useful

OmniMind still owns its application workspace model in Postgres. Clerk user IDs should map to internal app users/workspace members.

Existing Supabase Auth code is legacy and should be replaced during the auth/workspace phase.

## Secrets and Provider Key Encryption

Use Infisical for secret management.

Provider API keys are stored server-side encrypted using app-level envelope encryption. Encryption keys are stored and rotated through Infisical-managed secrets.

Provider keys must never be stored as plaintext in the database and must never be returned to the browser.

## Workflows

Use Inngest for durable workflows.

Used for:

- Council Mode stages
- file extraction
- scheduled model sync
- long exports
- usage aggregation jobs
- cleanup jobs

Do not introduce Temporal in v2 unless a future ADR supersedes this decision.

## Infrastructure

Use:

```txt
Cloudflare → Vercel for web
Cloudflare → Render Web Service for API
Render Background Worker + Inngest for workers/workflows
Neon Postgres
Upstash Redis
Cloudflare R2
Infisical
```

Do not introduce Kubernetes for the v2 rebuild.

Do not introduce AWS as the default v2 platform. AWS remains a future enterprise migration option only.

## Observability

Use:

- Sentry for frontend/backend errors.
- OpenTelemetry for distributed tracing.
- Langfuse for LLM traces and prompt observability.
- PostHog for product analytics.
- Axiom for structured logs.

## Explicit Legacy Items

The MVP currently contains technology choices that are not v2 targets:

- Bun package management.
- Supabase Auth.
- Browser localStorage as canonical conversation persistence.
- Browser localStorage provider-key storage.
- Next.js route handlers as the full AI orchestration backend.

These should be migrated away in the planned phases.
