# Phase 0 First Coding-Agent Prompt

Use this prompt to start the OmniMind v2 rebuild with a coding agent.

---

```txt
We are starting OmniMind v2 Phase 0.

Use Bootstrap Mode from @AGENTS.md because this is the first rebuild milestone.

Read these first, completely, before editing code:

@AGENTS.md
@docs/README.md
@docs/agent-execution-playbook.md
@docs/architecture/03-system-architecture.md
@docs/architecture/04-technology-stack.md
@docs/architecture/05-monorepo-structure.md
@docs/architecture/18-roadmap.md
@docs/architecture/19-domain-glossary.md
@docs/architecture/20-engineering-standards.md
@docs/master-rebuild-plan.md
@docs/adr/0001-dedicated-backend-orchestrator.md
@docs/adr/0006-definitive-v2-platform-stack.md

Task:
Implement the Phase 0 foundation in the smallest safe step.

Scope:
- Prepare a monorepo/workspace layout.
- Preserve the current Next.js app as the web app.
- Add an API app skeleton with a `/health` endpoint.
- Add package skeletons for `types`, `config`, `db`, `ai`, `telemetry`, and `ui`.
- Add or update root scripts so future agents can run checks consistently.
- Do not migrate chat, auth, provider logic, database logic, or UI yet.

Important:
- Before editing, inspect the repo and give a short implementation plan.
- After the plan, proceed with implementation.
- Keep changes minimal and reversible.
- Do not rewrite the UI.
- Do not change chat behavior.
- Do not touch provider orchestration.
- Do not introduce database schema beyond skeletons unless required for package setup.
- Update documentation only if the implemented structure differs from the documented plan.

Expected deliverables:
1. Workspace/monorepo structure prepared.
2. Existing Next.js app preserved as the web app, ideally under `apps/web` if safe.
3. New `apps/api` skeleton with a health endpoint.
4. New `packages/types` package with initial shared API/error types.
5. New `packages/config` package with environment validation skeleton.
6. New `packages/db` package skeleton for future Drizzle schema/migrations.
7. New `packages/ai` package skeleton for future LLM Gateway.
8. New `packages/telemetry` package skeleton for future logging/tracing.
9. New `packages/ui` package skeleton for future shared UI primitives.
10. Root package scripts updated for pnpm/Turborepo dev/build/type-check/lint/test workflows.
11. Legacy Bun workflow clearly marked for removal or removed if safe after pnpm is established.

Validation:
- Install dependencies if needed and practical.
- Run available type-check/lint/build commands where practical.
- If validation cannot be run, state exactly why.

Final response should include:
- Summary
- Files changed
- Validation run
- Any risks/follow-ups
- Recommended next task
```

---

## Notes

This prompt intentionally limits the coding agent to Phase 0 foundation work.

Do **not** start with provider key vault, chat run engine, LLM Gateway, database schema, or frontend chat migration until this milestone is complete.

The purpose of Phase 0 is to establish clean architectural boundaries so future work can proceed safely.
