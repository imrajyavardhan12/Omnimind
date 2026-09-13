# Contributing to OmniMind

Thanks for picking this up. OmniMind v2 is a disciplined rebuild — small,
reviewable slices that preserve architectural boundaries. This file is the
operator's contract for contributors (human or agent).

## Ground rules (from AGENTS.md)

1. **Backend owns orchestration.** No new provider calls in React components.
2. **No canonical data in `localStorage`.** Only pointers (conversation id) and
   preferences (model selection) may persist there.
3. **Provider keys stay server-side.** Never log, return, or persist plaintext
   keys in the browser.
4. **Shared Zod contracts.** API shapes live in `packages/types` — never redefine
   them loosely per route/component.
5. **Repository/service boundaries.** Routes validate → services orchestrate →
   repositories persist. No god files.
6. **No new stream event types** without updating
   `docs/architecture/09-streaming-protocol.md`.
7. **No new tables** without updating `docs/architecture/10-data-model.md` and a
   Drizzle migration.
8. **No new infra provider** without a stop-and-confirm + ADR
   (`docs/master-rebuild-plan.md` §18).

## Workflow

```bash
git checkout main && git pull
git checkout -b feat/<short-scope>   # or fix|docs|chore
# ... implement ONE milestone slice ...
pnpm type-check && pnpm lint && pnpm test && pnpm build
git push -u origin feat/<short-scope>  # PR to main, never push main directly
```

Branch off `main`. One milestone slice per PR. Keep diffs reviewable
(~<500 lines of non-snapshot code preferred; split M-style A/B/C slices like M5).

## PR checklist

- [ ] Gates green: `type-check`, `lint`, `test`, `build`
- [ ] Shared types updated (`packages/types`) if any contract changed
- [ ] Migration generated + applied locally if schema changed
- [ ] Tests added for gateway normalization / routes / repos / cost / reducers
- [ ] Docs updated (arch doc + handoff + ADR if decision-grade)
- [ ] No secrets in diff (`git diff --check`, no `.env.local`, no keys in fixtures)
- [ ] Handoff summary in PR body (Phase / Summary / Files / Validation / Risks / Next)

## Docs to read before coding

- `AGENTS.md` (reading modes + guardrails)
- `docs/master-rebuild-plan.md` (your milestone section only)
- `docs/architecture/20-engineering-standards.md`
- Task-specific arch doc + ADR (e.g. gateway → `08-llm-gateway.md` + ADR 0002)

## Environment

- Node >= 22, `pnpm@10.25.0` (repo-pinned). No Bun workflows for v2.
- Copy `.env.example` to `apps/api/.env.local` and `apps/web/.env.local`.
- DB: `cd packages/db && pnpm db:migrate && pnpm db:seed`.

## Code of conduct / security

- Be kind and direct. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- Never disclose a vulnerability publicly — see [SECURITY.md](SECURITY.md).
