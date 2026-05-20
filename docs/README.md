# OmniMind v2 Documentation

This directory documents the proposed production-grade rebuild of OmniMind.

The goal of OmniMind v2 is to move from an MVP-style Next.js application into a durable, secure, observable, scalable AI product platform.

## Start Here

If you are new to the project, read in this order:

1. [Product Vision](./architecture/01-product-vision.md)
2. [Architecture Principles](./architecture/02-architecture-principles.md)
3. [Target System Architecture](./architecture/03-system-architecture.md)
4. [Domain Glossary](./architecture/19-domain-glossary.md)
5. [Engineering Standards](./architecture/20-engineering-standards.md)
6. [Migration and Implementation Roadmap](./architecture/18-roadmap.md)
7. [Master Rebuild Plan](./master-rebuild-plan.md)
8. [ADR 0006: Definitive OmniMind v2 Platform Stack](./adr/0006-definitive-v2-platform-stack.md)
9. [Coding Agent Execution Playbook](./agent-execution-playbook.md)

Coding agents should also read the root [`AGENTS.md`](../AGENTS.md).

## Documentation Map

### 1. Product and Architecture Foundation

- [Product Vision](./architecture/01-product-vision.md)
- [Architecture Principles](./architecture/02-architecture-principles.md)
- [Target System Architecture](./architecture/03-system-architecture.md)
- [Technology Stack](./architecture/04-technology-stack.md)
- [Monorepo Structure](./architecture/05-monorepo-structure.md)
- [Domain Glossary](./architecture/19-domain-glossary.md)

### 2. Application Architecture

- [Frontend Architecture](./architecture/06-frontend-architecture.md)
- [Backend Architecture](./architecture/07-backend-architecture.md)
- [LLM Gateway Architecture](./architecture/08-llm-gateway.md)
- [Streaming Protocol](./architecture/09-streaming-protocol.md)
- [Data Model](./architecture/10-data-model.md)
- [API Design](./architecture/11-api-design.md)
- [File and Multimodal Pipeline](./architecture/12-file-pipeline.md)
- [Council Mode Workflow](./architecture/13-council-workflow.md)

### 3. Production Readiness

- [Security Architecture](./architecture/14-security.md)
- [Cost Controls and Rate Limiting](./architecture/15-cost-controls.md)
- [Observability](./architecture/16-observability.md)
- [Infrastructure and Deployment](./architecture/17-infrastructure.md)
- [Testing Strategy](./architecture/21-testing-strategy.md)
- [Production Launch Checklist](./architecture/23-launch-checklist.md)
- [Risk Register](./architecture/24-risk-register.md)
- [Production Runbooks](./runbooks.md)

### 4. Execution and Governance

- [Migration and Implementation Roadmap](./architecture/18-roadmap.md)
- [Master Rebuild Plan](./master-rebuild-plan.md)
- [Engineering Standards](./architecture/20-engineering-standards.md)
- [Product and UX Principles](./architecture/22-product-ux-principles.md)
- [Coding Agent Execution Playbook](./agent-execution-playbook.md)
- [Task Template](./task-template.md)
- [Phase 0 First Agent Prompt](./prompts/phase-0-first-agent-prompt.md)

### 5. Architecture Decision Records

- [ADR 0001: Use a Dedicated Backend Orchestration Layer](./adr/0001-dedicated-backend-orchestrator.md)
- [ADR 0002: Use Vercel AI SDK Behind an Internal LLM Gateway](./adr/0002-vercel-ai-sdk-gateway.md)
- [ADR 0003: Use SSE for Chat Run Streaming](./adr/0003-sse-streaming.md)
- [ADR 0004: Store Provider Keys Server-Side](./adr/0004-server-side-provider-key-vault.md)
- [ADR 0005: Use Neon Postgres as the Primary System of Record](./adr/0005-postgres-primary-store.md)
- [ADR 0006: Definitive OmniMind v2 Platform Stack](./adr/0006-definitive-v2-platform-stack.md)

## Reading Paths by Role

### Coding Agent

1. [`AGENTS.md`](../AGENTS.md)
2. [Coding Agent Execution Playbook](./agent-execution-playbook.md)
3. [Engineering Standards](./architecture/20-engineering-standards.md)
4. Task-specific architecture documents

### Product / UX

1. [Product Vision](./architecture/01-product-vision.md)
2. [Product and UX Principles](./architecture/22-product-ux-principles.md)
3. [Council Mode Workflow](./architecture/13-council-workflow.md)
4. [File and Multimodal Pipeline](./architecture/12-file-pipeline.md)

### Backend / Platform

1. [Backend Architecture](./architecture/07-backend-architecture.md)
2. [LLM Gateway Architecture](./architecture/08-llm-gateway.md)
3. [Data Model](./architecture/10-data-model.md)
4. [API Design](./architecture/11-api-design.md)
5. [Security Architecture](./architecture/14-security.md)

### Production / Operations

1. [Infrastructure and Deployment](./architecture/17-infrastructure.md)
2. [Observability](./architecture/16-observability.md)
3. [Cost Controls and Rate Limiting](./architecture/15-cost-controls.md)
4. [Risk Register](./architecture/24-risk-register.md)
5. [Production Runbooks](./runbooks.md)
6. [Production Launch Checklist](./architecture/23-launch-checklist.md)

## North Star Architecture

```txt
Cloudflare/CDN/WAF
  ├── Next.js Web App
  └── API Gateway/BFF
        ├── Chat Orchestrator
        ├── LLM Gateway
        ├── File Service
        ├── Workflow Worker
        ├── Neon Postgres
        ├── Upstash Redis
        └── Cloudflare R2
```

## Primary Rebuild Goals

1. Move conversations from browser-only storage to Neon Postgres.
2. Move provider keys from localStorage to a server-side encrypted vault.
3. Replace component-driven multi-model fan-out with backend chat runs.
4. Standardize model invocation behind an internal LLM Gateway.
5. Use one unified stream per user request.
6. Make file handling first-class through Cloudflare R2 and extraction jobs.
7. Make Council Mode durable and replayable through workflows.
8. Add cost tracking, budgets, rate limits, audit logs, and observability from day one.
