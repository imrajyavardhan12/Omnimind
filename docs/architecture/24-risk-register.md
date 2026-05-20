# 24 — Risk Register

This document tracks major risks for the OmniMind v2 rebuild and how to mitigate them.

## Risk Ratings

```txt
Low
Medium
High
Critical
```

## R1 — Provider Key Leakage

Severity: Critical

Risk:
Provider API keys could leak through logs, browser responses, telemetry, or improper storage.

Mitigation:

- Store keys server-side encrypted.
- Never return plaintext keys.
- Redact logs.
- Add tests for provider key APIs.
- Use secret scanning.

## R2 — Runaway Hosted Provider Spend

Severity: Critical

Risk:
Hosted/free provider keys could be abused or accidentally overused.

Mitigation:

- Strict hosted quotas.
- Daily/monthly budgets.
- Per-user and per-IP limits.
- Spend alerts.
- Disable hosted access on anomaly.

## R3 — Frontend Reintroduces Provider Orchestration

Severity: High

Risk:
Agents may add quick direct provider calls in React components, recreating MVP coupling.

Mitigation:

- Enforce AGENTS.md guardrails.
- Code review checks.
- Keep LLM Gateway path easy to use.
- Avoid exposing provider keys to frontend.

## R4 — Streaming Complexity Causes Inconsistent UX

Severity: High

Risk:
Multi-model streaming can produce ordering, cancellation, retry, and partial failure bugs.

Mitigation:

- Use typed SSE event protocol.
- Add sequence numbers.
- Test stream reducers.
- Persist run events where useful.

## R5 — Database Migration Mistakes

Severity: High

Risk:
Bad migrations may break production data.

Mitigation:

- Use versioned migrations.
- Review production migrations.
- Avoid destructive changes without backfill.
- Test restore path.

## R6 — Provider API Instability

Severity: Medium

Risk:
Providers change model behavior, streaming format, rate limits, or deprecate models.

Mitigation:

- Centralize provider code in LLM Gateway.
- Use model registry flags.
- Add provider health checks.
- Add circuit breakers.

## R7 — Overengineering Too Early

Severity: Medium

Risk:
The rebuild could stall by introducing Kubernetes, too many services, or complex infra too early.

Mitigation:

- Start as modular monorepo.
- Use managed infra.
- Follow roadmap phases.
- Require ADR for major infra complexity.

## R8 — Under-Instrumentation

Severity: High

Risk:
Production issues become impossible to debug.

Mitigation:

- Add request IDs.
- Add structured logs.
- Add traces around provider calls.
- Store run/model-run statuses.
- Track usage/cost.

## R9 — File Access Leakage

Severity: Critical

Risk:
Users could access files from another workspace.

Mitigation:

- Workspace-scoped file checks.
- Private buckets.
- Signed URLs.
- Authorization tests.

## R10 — LocalStorage Migration Data Loss

Severity: Medium

Risk:
Existing users may lose old conversations during migration.

Mitigation:

- Provide import flow.
- Do not auto-delete legacy data until import confirmed.
- Handle malformed old data safely.

## R11 — Cost Accounting Inaccuracy

Severity: Medium

Risk:
Token/cost data may be inaccurate across providers.

Mitigation:

- Prefer provider-reported usage.
- Mark estimated usage clearly.
- Use model catalog pricing.
- Update pricing regularly.

## R12 — Council Workflow Quality Issues

Severity: Medium

Risk:
Council rankings may parse incorrectly or produce weak synthesis.

Mitigation:

- Version prompts.
- Store raw and parsed rankings.
- Add parser tests.
- Add fallback ranking behavior.
- Expose confidence/parse status.

## R13 — Auth/Workspace Authorization Bugs

Severity: Critical

Risk:
Users may access resources outside their workspace.

Mitigation:

- Central workspace middleware.
- Repository methods require workspace ID.
- Integration tests for cross-workspace access.

## R14 — Dependency Lock-In

Severity: Medium

Risk:
Depending directly on a specific AI SDK/proxy everywhere makes migration hard.

Mitigation:

- Use internal LLM Gateway contract.
- Keep Vercel AI SDK behind gateway.
- Use ADRs for provider-layer changes.

## R15 — Agent Drift

Severity: Medium

Risk:
Multiple agents may make inconsistent architectural decisions.

Mitigation:

- AGENTS.md.
- Execution playbook.
- Task template.
- ADRs.
- Docs-first workflow.
