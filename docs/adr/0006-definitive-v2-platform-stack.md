# ADR 0006 — Definitive OmniMind v2 Platform Stack

## Status

Accepted

## Context

The architecture docs originally evaluated multiple viable choices for package management, API hosting, database, cache, file storage, authentication, secrets, and deployment.

For a long multi-agent rebuild, options create confusion. Future coding agents should not have to decide between Bun vs pnpm, Hono vs Fastify, AWS vs managed platforms, R2 vs S3, or Supabase vs Neon.

## Decision

OmniMind v2 will use a lean managed production stack, not AWS as the default platform.

The architecture and implementation plan should use these exact v2 services. Agents should not choose alternatives during implementation.

## Final Stack

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

## Explicit Non-Choices for v2

The following are not part of the v2 default stack:

- Do not use Bun as the package manager/runtime for v2.
- Do not use Fastify as the backend framework.
- Do not use Supabase Auth for v2.
- Do not use Supabase Postgres as the v2 production database.
- Do not use AWS ECS/Fargate as the v2 default API host.
- Do not use AWS RDS as the v2 default database.
- Do not use AWS ElastiCache as the v2 default cache/rate-limit service.
- Do not use AWS S3 as the v2 default file storage service.
- Do not use AWS Secrets Manager/KMS as the v2 default secrets/encryption provider.
- Do not use Fly.io as the v2 default API host.
- Do not use Railway as the v2 default API host.
- Do not use Temporal as the v2 workflow engine.
- Do not use LiteLLM as the primary provider abstraction.
- Do not use Kubernetes as the v2 deployment platform.

These technologies may be useful in other contexts, but they should not be introduced into this rebuild unless a new ADR supersedes this one.

## Rationale

This stack is the best fit for OmniMind v2 because it is:

- production-grade enough for a serious v2 launch
- significantly simpler to operate than an AWS-heavy stack
- easier for coding agents to implement consistently
- well-aligned with modern TypeScript SaaS development
- scalable enough for early and mid-stage product growth
- still portable because the architecture uses clean primitives

The hard parts of OmniMind are product/backend concerns: LLM orchestration, streaming, usage accounting, secure provider keys, file processing, and Council Mode. The v2 infrastructure should minimize operational drag so engineering effort stays focused on those product problems.

## Future AWS Migration

AWS remains a future enterprise-scale migration option, not the v2 default.

A future AWS migration must be planned in a separate ADR if enterprise scale, compliance, private networking, or operational requirements justify it.

The v2 rebuild must not implement AWS services by default.

## Consequences

### Positive

- Removes decision ambiguity for coding agents.
- Keeps the v2 rebuild operationally simple.
- Avoids AWS complexity during product architecture work.
- Gives a clear production profile.
- Keeps architecture portable by relying on primitives.
- Preserves a future AWS migration path.

### Negative

- Less infrastructure control than a fully AWS-native deployment.
- More vendor variety across managed services.
- Future enterprise customers may require an AWS migration.

## Migration Notes

- Phase 0 must migrate project tooling to pnpm + Turborepo.
- Existing Bun lockfile is legacy and should be removed once pnpm lockfile is established.
- Existing Supabase auth code is legacy and should be replaced by Clerk during the auth/workspace phase.
- Existing localStorage and provider-key storage remain legacy until their v2 replacements land.

## Rule for Agents

Agents must implement against this stack by default.

If a task appears to require AWS, Supabase Auth, Bun, Fastify, Temporal, LiteLLM, or another non-choice technology, stop and request an ADR update before implementing.
