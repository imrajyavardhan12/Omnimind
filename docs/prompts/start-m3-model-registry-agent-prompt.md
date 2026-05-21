# Start M3 Model Registry Coding-Agent Prompt

Use this prompt when starting a new coding-agent session after M2 Provider Key Vault has been completed.

This prompt does **not** require a separate M2 code-review markdown file. If no review file exists, the agent must verify M2 readiness by reading the M2 handoff and inspecting the actual implementation.

---

```txt
We have completed and reviewed OmniMind v2 M0, M1, and M2.

Important: @docs/handoff-m2.md may say the next recommended task is LLM Gateway Foundation. That is outdated/inconsistent with the authoritative master plan. Do not start LLM Gateway in this session.

The authoritative sequence is:
M3 — Model Registry
M4 — LLM Gateway

We are now starting M3 — Model Registry.

Use Bootstrap Mode from @AGENTS.md because this is a new session and a new major milestone transition.

Read these first:

@AGENTS.md
@docs/README.md
@docs/master-rebuild-plan.md
@docs/agent-execution-playbook.md
@docs/architecture/04-technology-stack.md
@docs/architecture/07-backend-architecture.md
@docs/architecture/08-llm-gateway.md
@docs/architecture/10-data-model.md
@docs/architecture/11-api-design.md
@docs/architecture/15-cost-controls.md
@docs/architecture/18-roadmap.md
@docs/architecture/20-engineering-standards.md
@docs/adr/0004-server-side-provider-key-vault.md
@docs/adr/0005-postgres-primary-store.md
@docs/adr/0006-definitive-v2-platform-stack.md

Also find and read prior M0, M1, and M2 handoff files. They may be named like:

- handoff-m0.md
- handoff-m1.md
- handoff-m2.md
- handoffm0.md
- handoffm1.md
- handoffm2.md
- docs/handoffs/*

If a separate review file exists, read it too. A review file is helpful but not required.

If you cannot find one or more handoff files, state that clearly and continue by inspecting the repository directly.

Task:
1. Re-establish current project state after M0–M2.
2. Perform a brief M2 acceptance verification from code and handoff notes.
3. Verify there are no M2 blockers that would prevent M3.
4. Produce a short M3 implementation plan.
5. Then implement the smallest safe M3 slice.

Do not assume M2 is correct only because a handoff says it is done. Verify the important M2 boundaries in code before implementing M3.

M2 readiness check:
Confirm, at minimum:
- Provider key schema/table exists if M2 implemented schema.
- Provider key APIs exist or M2 handoff explains why deferred.
- Provider key plaintext is not returned to the browser.
- Provider keys are encrypted server-side using app-level envelope encryption with Infisical-managed secrets.
- Provider key metadata/fingerprint behavior is safe.
- Provider key operations are workspace-scoped.
- Audit logging exists or M2 handoff explains why deferred.
- Frontend no longer relies on browser-stored provider keys for the v2 path, or legacy path is clearly marked.
- Tests/validation for key security boundaries exist where practical.

Important:
Do not start M4 LLM Gateway yet.
Do not migrate chat run behavior yet.
Do not add provider calls directly in frontend or API routes.
Do not introduce any non-choice stack items.

Strict stack compliance:
Confirm the implementation continues to use:
- pnpm
- Turborepo
- Hono
- Clerk
- Neon Postgres
- Drizzle ORM
- Upstash Redis only where needed
- Cloudflare R2 only where needed
- Infisical
- Render-compatible app/worker structure

Confirm it does NOT introduce:
- Bun as v2 package manager
- Fastify
- Supabase Auth
- Supabase Postgres as v2 production DB
- AWS as default infra
- Fly.io or Railway as default API host
- Temporal
- LiteLLM as primary provider abstraction
- Kubernetes

M3 expected scope:
- Add `model_catalog` schema/table if not already present.
- Add Drizzle migration for model catalog.
- Add seed data for initial verified models.
- Include model capability metadata:
  - provider
  - model id
  - display name
  - description
  - context window
  - max output tokens
  - input/output pricing
  - supports streaming
  - supports vision
  - supports tools
  - supports JSON
  - supports files
  - enabled/deprecated flags
  - metadata JSON if needed
- Add model catalog repository/service.
- Add model list API endpoint according to @docs/architecture/11-api-design.md.
- Add capability/filter query support where practical.
- Ensure cost calculation can use model catalog pricing later.
- Add tests for schema/repository/API behavior where practical.

Suggested M3 slicing:
If M3 is too large for one session, implement M3A first:
- schema
- migration
- seed file
- repository/service
- backend model list API
- tests

Then leave frontend model picker migration as M3B.

Before editing:
State:

Current milestone:
Task reading mode:
Docs read:
Handoffs/reviews read, if any:
Files inspected:
M2 readiness summary:
Planned M3 slice:
Out of scope:

Validation:
Run available checks:

```txt
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

If a command cannot be run, explain exactly why.

Final response format:

1. Current-state assessment
   - M0 status summary
   - M1 status summary
   - M2 status summary
   - Ready for M3: Yes / No

2. M2 readiness verification
   - security/key storage notes
   - workspace scoping notes
   - tests/validation notes
   - blockers, if any

3. M3 implementation summary

4. Files changed

5. Validation results

6. Architecture/stack compliance notes

7. M3 completion status
   - M3A complete / partial
   - Remaining M3B tasks, if any

8. Risks/blockers

9. Recommended next task/prompt
```

---

## Recommended next step after this prompt

If the agent completes M3A only, the next session should finish M3B by migrating frontend model selection to the model catalog API.

If the agent completes all of M3, the next milestone is M4 — LLM Gateway.
