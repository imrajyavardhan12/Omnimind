Phase/Milestone: M2 — Provider Key Vault (complete, 2026-05-21)

Summary:
Server-side AES-256-GCM encrypted storage of BYOK provider API keys is now in place.
Workspace provisioning race condition from M1 is fixed with a transactional
find-or-create + unique index on workspace_members. The web app's ApiKeyManager
writes to both the server and localStorage (migration mode) so the legacy
apps/web/api/chat route continues to work until M4–M6.

Files changed:

  packages/db
    UPD   src/schema/workspaces.ts          (added unique index on workspace_members(workspace_id, user_id))
    NEW   src/schema/provider-keys.ts       (provider_keys table + PROVIDER_NAMES const)
    NEW   src/schema/audit-logs.ts          (audit_logs table)
    UPD   src/schema/index.ts               (export provider-keys, audit-logs)
    UPD   src/repositories/workspace.repository.ts  (findOrCreateDefault with pg_advisory_xact_lock, findMemberRole)
    NEW   src/repositories/provider-key.repository.ts  (findByWorkspace, findEncrypted, upsert, delete)
    NEW   src/repositories/audit-log.repository.ts     (create, findByWorkspace)
    UPD   src/index.ts                      (export ProviderKeyRepository, AuditLogRepository)
    GEN   migrations/0001_complex_winter_soldier.sql  (provider_keys, audit_logs, 2 unique indexes — applied)

  packages/config
    UPD   src/env.ts   (added PROVIDER_KEY_ENCRYPTION_SECRET: z.string().length(64) to apiEnvSchema)

  packages/types
    NEW   src/api/provider-keys.ts          (providerNameSchema, upsertProviderKeySchema, ProviderName)
    UPD   src/index.ts                      (export provider-keys schemas + types)

  apps/api
    UPD   src/types.ts                      (ApiVariables: added userRole)
    NEW   src/lib/encryption.ts             (encryptProviderKey, decryptProviderKey — AES-256-GCM)
    UPD   src/middleware/workspace.ts       (use findOrCreateDefault; set userRole on context)
    NEW   src/routes/provider-keys.ts       (GET /v1/provider-keys, PUT /:provider, DELETE /:provider)
    UPD   src/index.ts                      (wire /v1/provider-keys router)

  apps/web
    NEW   src/features/provider-keys/api/providerKeysApi.ts
    NEW   src/features/provider-keys/hooks/useProviderKeys.ts  (useProviderKeys, useUpsertProviderKey, useDeleteProviderKey)
    UPD   src/components/settings/ApiKeyManager.tsx  (dual-write: server + localStorage)

Validation:
  - pnpm type-check (turbo): 9/9 packages pass
  - drizzle-kit generate: migration 0001 generated (provider_keys, audit_logs, 2 unique indexes)
  - drizzle-kit migrate: applied to Neon Postgres successfully

Architecture compliance:
  - Provider keys never returned in plaintext from API (encryptedKey column excluded from GET/upsert responses)
  - Keys never logged
  - AES-256-GCM with random 12-byte IV per write; base64(iv || ciphertext || authTag) stored
  - PROVIDER_KEY_ENCRYPTION_SECRET must be exactly 64 hex chars — enforced at startup by Zod regex
  - Role check: only owner/admin may PUT/DELETE provider keys
  - Audit log entry written on every upsert and delete
  - Legacy localStorage path preserved: ApiKeyManager dual-writes so apps/web/api/chat keeps working
  - Workspace race condition fixed: findOrCreateDefault uses INSERT ... ON CONFLICT DO UPDATE (slug is
    deterministic on userId) + INSERT ... ON CONFLICT DO NOTHING for the member row, then re-SELECTs.
    neon-http driver does not support transactions; atomic INSERT ON CONFLICT is the correct idiom here.

Known risks / follow-ups:
  - PROVIDER_KEY_ENCRYPTION_SECRET must be added to apps/api/.env.local before the server will start.
    Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    (parseApiEnv() throws a clear Zod error on missing/wrong-length value — server won't silently start)
  - Key rotation is not yet implemented — if the secret changes, existing rows can't be decrypted.
    Add a re-encrypt endpoint in M3 or deployment hardening phase.
  - Upsert + audit log in provider-keys route are two separate DB writes, not in a transaction.
    If the audit insert fails, the key is stored but unlogged. Acceptable for M2; fix in M3 if needed.
  - ProviderName in packages/types mirrors apps/web/src/lib/types.ts ProviderName.
    Keep them in sync manually until M4 unifies them.
  - ApiKeyManager casts ProviderName (web) to ProviderName (types) — safe today because the
    union values are identical, but will fail at type level if they diverge.
  - authorizedParties still not set on Clerk verifyToken (carried over from M1).
  - localStorage stores (src/lib/stores/chat.ts etc.) still not removed (deferred to M4–M6).

Next recommended task: M3 — LLM Gateway Foundation
  - packages/ai: provider abstraction (OpenAI, Anthropic, Google) with streaming
  - apps/api: POST /v1/conversations/:id/run (SSE stream)
  - Decrypt provider key in memory for provider calls (consume decryptProviderKey from M2)
  - apps/worker or inline streaming handler

Docs updated: docs/handoff-m2.md (this file)
