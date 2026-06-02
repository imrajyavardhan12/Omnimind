# AGENTS.md — OmniMind v2 Rebuild Operating Manual

This file is the primary instruction manual for coding agents working on the OmniMind v2 rebuild.

The goal is to rebuild OmniMind as a production-grade AI platform with the discipline of a principal/staff engineering project.

Agents must treat the architecture docs as the source of truth and should not make large architectural changes without updating the relevant documentation and ADRs.

---

## 1. First Principles

Before writing code, understand the target architecture.

OmniMind v2 is not a cosmetic refactor. It is a deliberate rebuild from MVP-style architecture into:

```txt
Next.js Web App
  → API Gateway/BFF
  → Chat Orchestrator
  → LLM Gateway
  → Provider APIs
  → Neon Postgres / Upstash Redis / Cloudflare R2 / Workers
```

Core rules:

1. Backend owns orchestration.
2. Frontend does not fan out directly to providers.
3. Provider keys are not stored long-term in browser localStorage.
4. Neon Postgres is the canonical system of record.
5. Every user prompt creates a durable run.
6. Every model response belongs to a model run.
7. Every provider call should be observable and cost-accounted.
8. Large changes must be phased and documented.

---

## 2. Documentation Reading Modes

Do not read every document for every task. The documentation is intentionally comprehensive, but agents should choose the correct reading mode based on the situation.

### Bootstrap Mode

Use Bootstrap Mode when:

- Starting the rebuild for the first time.
- Starting a new major milestone.
- Joining with little/no prior context.
- The current repository state is unclear.
- A task affects architecture boundaries.

Read these files in order:

```txt
docs/README.md
docs/architecture/01-product-vision.md
docs/architecture/02-architecture-principles.md
docs/architecture/03-system-architecture.md
docs/architecture/19-domain-glossary.md
docs/architecture/20-engineering-standards.md
docs/architecture/18-roadmap.md
docs/master-rebuild-plan.md
docs/adr/0006-definitive-v2-platform-stack.md
docs/agent-execution-playbook.md
```

### Task Mode

Use Task Mode for normal implementation work inside an already-known milestone.

Read only:

```txt
AGENTS.md
docs/master-rebuild-plan.md              # relevant milestone section only
docs/architecture/20-engineering-standards.md
task-specific architecture docs
task-specific ADRs, if any
```

### Quick Fix Mode

Use Quick Fix Mode for small, low-risk changes such as typos, broken links, minor docs updates, or obvious local fixes.

Read only:

```txt
AGENTS.md
relevant file(s) being changed
```

Still follow architecture guardrails. If the quick fix touches API contracts, database schema, provider behavior, security, streaming, or orchestration, switch to Task Mode or Bootstrap Mode.

### Current-State Orientation

At the start of any coding task, determine and state:

```txt
Current milestone:
Task reading mode:
Docs read:
Files inspected:
Planned scope:
Out of scope:
```

If the current milestone is unclear, inspect the repository and `docs/master-rebuild-plan.md`, then state your best assessment before editing.

## 3. Task-Specific Reading Guide

#### If working on project structure / monorepo

```txt
docs/architecture/04-technology-stack.md
docs/architecture/05-monorepo-structure.md
docs/adr/0001-dedicated-backend-orchestrator.md
```

#### If working on frontend

```txt
docs/architecture/06-frontend-architecture.md
docs/architecture/06b-frontend-standards.md
docs/architecture/09-streaming-protocol.md
docs/architecture/11-api-design.md
docs/architecture/22-product-ux-principles.md
```

#### If working on backend/API

```txt
docs/architecture/07-backend-architecture.md
docs/architecture/10-data-model.md
docs/architecture/11-api-design.md
docs/adr/0001-dedicated-backend-orchestrator.md
```

#### If working on LLM/provider code

```txt
docs/architecture/08-llm-gateway.md
docs/architecture/09-streaming-protocol.md
docs/architecture/15-cost-controls.md
docs/adr/0002-vercel-ai-sdk-gateway.md
```

#### If working on streaming

```txt
docs/architecture/09-streaming-protocol.md
docs/adr/0003-sse-streaming.md
```

#### If working on database/schema

```txt
docs/architecture/10-data-model.md
docs/adr/0005-postgres-primary-store.md
```

#### If working on provider keys/security

```txt
docs/architecture/14-security.md
docs/adr/0004-server-side-provider-key-vault.md
```

#### If working on files/uploads/multimodal

```txt
docs/architecture/12-file-pipeline.md
docs/architecture/14-security.md
```

#### If working on Council Mode

```txt
docs/architecture/13-council-workflow.md
docs/architecture/08-llm-gateway.md
docs/architecture/09-streaming-protocol.md
```

#### If working on infra/deployment/observability

```txt
docs/architecture/16-observability.md
docs/architecture/17-infrastructure.md
docs/architecture/15-cost-controls.md
docs/architecture/23-launch-checklist.md
docs/architecture/24-risk-register.md
docs/runbooks.md
```

---

## 4. Rebuild Phase Order

Agents should work in this order unless explicitly instructed otherwise.

```txt
Phase 0: Foundation and project structure
Phase 1: Auth, workspace, and persistence
Phase 2: Provider key vault
Phase 3: Model registry
Phase 4: LLM Gateway
Phase 5: Chat run engine
Phase 6: Frontend migration to backend runs
Phase 7: File pipeline
Phase 8: Council workflow v2
Phase 9: Observability, cost controls, and production hardening
```

Do not skip foundational phases just to make UI features work quickly.

---

## 5. Agent Work Protocol

For every meaningful task, follow this loop:

```txt
1. Read relevant docs.
2. Inspect current code.
3. Identify phase and architectural boundary.
4. Draft a short implementation plan.
5. Make minimal coherent changes.
6. Add or update tests where practical.
7. Run type-check/lint/tests/build where possible.
8. Update docs if behavior or architecture changed.
9. Summarize changed files and risks.
```

Do not perform large unplanned rewrites in one step.

---

## 6. Architectural Guardrails

### Do Not

- Do not add new provider calls directly inside React components.
- Do not add new long-term localStorage persistence for canonical data.
- Do not store provider keys in browser storage as the v2 default.
- Do not add provider-specific API logic outside the LLM Gateway once it exists.
- Do not create new database tables without updating schema docs.
- Do not add new stream event types without updating the streaming protocol doc.
- Do not hardcode model pricing in random files.
- Do not add workflow logic to frontend hooks if it belongs in workers.
- Do not introduce Kubernetes or complex infra prematurely.

### Prefer

- Shared Zod schemas for API contracts.
- Server-side persistence for canonical state.
- Repository/service boundaries in backend code.
- Typed stream events.
- Explicit error codes.
- Feature flags for incomplete migrations.
- Small, reviewable steps.

---

## 7. Expected Repository Direction

The current repository is a Next.js app. The target direction is a monorepo.

Expected future layout:

```txt
apps/
  web/
  api/
  worker/

packages/
  ai/
  db/
  types/
  config/
  telemetry/
  ui/
```

Until the monorepo migration is performed, agents may work within the current structure only when necessary, but must not deepen coupling that the monorepo is meant to remove.

---

## 8. Coding Standards

Use:

- TypeScript strictness.
- Zod for runtime validation.
- Explicit domain types.
- Stable error codes.
- Structured logs.
- Small modules.
- Clear service/repository boundaries.

Avoid:

- `any` unless unavoidable.
- Large god files.
- Copy-pasted provider logic.
- Hidden side effects in components.
- Business logic embedded in JSX.

---

## 9. Testing Expectations

Agents should read `docs/architecture/21-testing-strategy.md` before implementing test-heavy or high-risk changes.

Agents should add tests where the architecture benefits from confidence.

Prioritize tests for:

- LLM Gateway normalization.
- Stream event parsing.
- API request validation.
- Provider key encryption/decryption boundaries.
- Usage/cost calculation.
- Model capability checks.
- Database repositories.
- Council ranking parser.

If tests are not possible in a step, explain why.

---

## 10. Documentation Update Rules

Update docs when changing:

- API contracts.
- Stream event shapes.
- Database schema.
- Provider gateway behavior.
- Security model.
- Infrastructure decisions.
- Phase order.
- Major dependencies.

Use ADRs for irreversible or high-impact decisions.

---

## 11. Environment and Commands

OmniMind v2 uses:

```txt
pnpm + Turborepo
```

Phase 0 must migrate away from the MVP Bun workflow. After Phase 0, agents should use pnpm commands only.

Required v2 commands:

```txt
pnpm install
pnpm type-check
pnpm lint
pnpm test
pnpm build
pnpm dev
```

Before Phase 0 is complete, the repository may still contain legacy Bun files. Treat them as migration inputs, not v2 decisions.

Do not add new Bun-specific workflow files for v2.

Do not assume `node_modules` exists.

---

## 12. Definition of Done for Agent Tasks

A task is done when:

1. The code change aligns with architecture docs.
2. Relevant tests/checks pass or failures are documented.
3. Any changed contracts are documented.
4. The implementation does not deepen known MVP anti-patterns.
5. The final response lists files changed, validation performed, and next steps.

---

## 13. If Unsure

When uncertain, choose the path that:

1. Preserves architectural boundaries.
2. Keeps secrets server-side.
3. Makes state durable and observable.
4. Keeps changes small and reversible.
5. Updates docs before or alongside implementation.
