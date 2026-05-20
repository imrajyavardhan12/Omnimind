# 17 — Infrastructure and Deployment

This document defines the production infrastructure target for OmniMind v2.

For the definitive stack decision, see [ADR 0006 — Definitive OmniMind v2 Platform Stack](../adr/0006-definitive-v2-platform-stack.md).

## Production Infrastructure

```txt
Cloudflare
  → Vercel web app
  → Render Web Service for API
  → Render Background Worker + Inngest for workflows
  → Neon Postgres
  → Upstash Redis
  → Cloudflare R2
  → Infisical
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

## Edge Layer

Use Cloudflare for:

- DNS
- TLS
- CDN
- WAF
- DDoS protection
- bot protection
- edge-level IP rate limiting

Cloudflare is the only edge/WAF/DNS provider for v2.

## Web App

Deploy `apps/web` to Vercel.

Vercel owns:

- Next.js web hosting
- preview deployments
- frontend environment variables
- static asset delivery

## API Service

Deploy `apps/api` as a Dockerized Node.js 22 service on Render Web Service.

The API service uses:

- Hono
- TypeScript
- Zod
- OpenTelemetry instrumentation
- Infisical-managed secrets

## Worker Service

Deploy `apps/worker` as a Render Background Worker.

The worker hosts Inngest handlers and background processing code.

Worker responsibilities:

- Council Mode workflows
- file extraction
- model catalog sync
- usage aggregation
- long exports
- cleanup jobs

## Inngest

Use Inngest for durable workflows.

Inngest is the v2 durable workflow engine. Do not introduce Temporal during the v2 rebuild unless a future ADR supersedes this decision.

## Database

Use Neon Postgres.

Requirements:

- branching for staging/preview where useful
- backups enabled for production
- migration pipeline
- connection pooling strategy
- pgvector extension available when needed

## Cache and Rate Limits

Use Upstash Redis.

Used for:

- rate limits
- idempotency keys
- cancellation flags
- provider health cache
- short-lived stream/run metadata

## Cloudflare R2

Use Cloudflare R2 for file storage.

Buckets:

```txt
omnimind-prod-files
omnimind-prod-exports
omnimind-prod-artifacts
```

Rules:

- buckets are private by default
- access uses signed URLs
- lifecycle policies clean deleted/expired artifacts
- encryption at rest is enabled according to Cloudflare R2 defaults/configuration

## Secrets

Use Infisical.

Infisical stores:

- Neon database credentials
- Upstash Redis credentials
- Clerk secrets
- provider hosted keys
- provider key encryption root secrets
- observability secrets
- Render deployment/runtime secrets

Provider key encryption uses app-level envelope encryption with key material managed through Infisical.

## Authentication

Use Clerk.

The API verifies Clerk sessions/JWTs and maps Clerk users to internal OmniMind users/workspace memberships.

## Environments

Use isolated environments:

```txt
local
staging
production
```

Each environment has separate:

- Clerk application/configuration
- Neon database/branch
- Upstash Redis database
- Cloudflare R2 buckets or prefixes
- Infisical environment
- observability projects

## CI/CD

CI must run:

```txt
pnpm install --frozen-lockfile
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

Deployment flow:

```txt
pull request → preview checks → merge → staging deploy → production deploy approval
```

## Database Migrations

Use Drizzle migrations.

Rules:

- migrations are committed to git
- migrations run automatically in staging
- production migrations require explicit deploy step/approval
- destructive migrations require backfill/rollback plan

## Scaling Strategy

### Web

Vercel handles web scaling.

### API

Scale Render Web Service instances based on:

- CPU
- memory
- request latency
- active SSE connections

### Worker

Scale Render Background Worker instances based on:

- Inngest backlog
- job latency
- CPU/memory

### Database

Scale with:

- query optimization
- indexes
- connection pooling
- Neon plan/compute scaling
- read replicas only when required

## Reverse Proxy and Load Balancer

Use:

```txt
Cloudflare → Render Web Service
```

Do not manually operate Nginx for v2.

Do not introduce Kubernetes for v2.

Do not introduce AWS as the default v2 infrastructure platform.

## Disaster Recovery

Minimum production requirements:

- Neon production backups
- tested restore process
- R2 lifecycle policy
- Infisical secret rotation process
- documented rollback process
- production runbooks

## Required Runbooks

See [Production Runbooks](../runbooks.md).

Required before launch:

- provider outage
- provider rate limits
- hosted spend spike
- database outage
- Upstash Redis outage
- bad deployment rollback
- security incident
- file processing backlog
