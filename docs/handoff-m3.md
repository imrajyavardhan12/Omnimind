Phase/Milestone: M3 — Model Registry (complete, 2026-05-21)

Summary:
Server-owned model registry is implemented end-to-end. The API owns the model catalog,
pricing, and capability metadata. The web model pickers now read from `GET /v1/models`
instead of static verified-model arrays. Backend capability validation helpers are in
place for M4/M5 gateway/run validation.

Files changed:

  packages/types
    NEW   src/api/models.ts               (modelCapabilitySchema, listModelsQuerySchema, modelCatalogEntrySchema)
    UPD   src/index.ts                    (export model schemas + types)

  packages/db
    NEW   src/schema/model-catalog.ts     (model_catalog table, capability/pricing columns)
    UPD   src/schema/index.ts             (export model-catalog)
    NEW   src/repositories/model-catalog.repository.ts  (findAll, findByProviderModel, upsert)
    NEW   src/services/model-catalog.service.ts         (list/find/validateSelection capability helper)
    UPD   src/index.ts                    (export repository/service/types)
    GEN   migrations/0002_thick_stellaris.sql          (model_catalog table + unique index — generated, NOT applied here)
    NEW   src/seed/model-catalog.seed.ts  (17 models across OpenAI, Anthropic, Gemini, Google AI Studio, OpenRouter)
    UPD   package.json                    (db:seed script, tsx devDependency)

  apps/api
    NEW   src/routes/models.ts            (GET /v1/models with provider/capability/enabledOnly filters)
    UPD   src/index.ts                    (wire /v1/models router)

  apps/web
    NEW   src/features/models/api/modelsApi.ts
    NEW   src/features/models/hooks/useModels.ts
    NEW   src/features/models/lib/modelCatalogAdapter.ts
    UPD   chat/council model picker components to use API-backed catalog
    UPD   model tabs store no longer imports static verified model lists
    UPD   settings defaults migrate legacy gpt-4 IDs to catalog-backed gpt-4o IDs

Validation:
  - `sfw pnpm type-check`: PASS (9/9 packages)
  - `sfw pnpm lint`: PASS (Next lint, no warnings/errors)
  - `sfw pnpm test`: no test tasks configured/executed
  - `sfw pnpm build`: PASS (API + web production build)
  - `pnpm db:migrate`: NOT applied here. Apply manually after confirming Neon access:
      cd packages/db && sfw pnpm db:migrate
  - `pnpm db:seed`: NOT run here. Run after migration:
      cd packages/db && sfw pnpm db:seed

Architecture compliance:
  - Model catalog is server-owned and exposed through authenticated `/v1/models`.
  - Frontend model selection is API-backed via TanStack Query feature hooks.
  - Pricing remains in model_catalog as numeric per-1M token values and is adapted to legacy UI per-1K display only at the UI boundary.
  - Backend capability validation helper returns stable model/capability error codes for M4/M5 usage.
  - No provider SDK calls were added to React components.
  - No chat run orchestration or LLM Gateway work was started.
  - v2 stack remains pnpm/Turborepo/Hono/Clerk/Neon/Drizzle-compatible; no banned stack items introduced.

Known risks / follow-ups:
  - Migration 0002 and seed must be applied to Neon before API-backed pickers have data.
  - Seed pricing should be reviewed against live provider pricing before cost accounting goes live.
  - Legacy web provider classes still import static verified models for direct provider routes; that is M4–M6 migration debt, not model picker state.
  - API-backed model picker still relies on legacy local provider settings for provider access hints until provider-key UX is fully migrated.
  - No automated test tasks exist yet; M4 should add test coverage for model capability validation and gateway behavior.

M3 completion status:
  - M3A backend registry: complete.
  - M3B frontend picker migration: complete.
  - M3 exit criteria: satisfied in code; pending database migration/seed application in the target environment.

Next recommended task: M4 — LLM Gateway
  - packages/ai: LLMGateway interface + normalized types/events.
  - Integrate Vercel AI SDK behind gateway adapters.
  - Use ModelCatalogService.validateSelection before provider calls.
  - Consume M2 provider-key decrypt flow only inside backend/gateway code.
  - Add gateway tests for normalization, capability validation, errors, cancellation, and usage.
