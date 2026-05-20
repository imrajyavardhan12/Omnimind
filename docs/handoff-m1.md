Phase/Milestone: M1 — Server Persistence Foundation (complete, 2026-05-20)

Summary:
Clerk authentication, Neon Postgres + Drizzle ORM, and a full conversation/message
persistence layer are now in place. Authenticated users get a default workspace
provisioned on first request. The web app's Supabase auth is replaced with Clerk.
next build passes cleanly for the first time (pre-existing Supabase env failure fixed).

Files changed:

  packages/db
    NEW   src/schema/users.ts            (app_users table)
    NEW   src/schema/workspaces.ts       (workspaces, workspace_members tables)
    NEW   src/schema/conversations.ts    (conversations, messages tables)
    NEW   src/schema/index.ts
    NEW   src/client.ts                  (neon + drizzle factory: createDb)
    NEW   src/repositories/user.repository.ts
    NEW   src/repositories/workspace.repository.ts
    NEW   src/repositories/conversation.repository.ts
    NEW   src/repositories/message.repository.ts
    UPD   src/index.ts
    NEW   drizzle.config.ts
    UPD   package.json                   (added drizzle-orm, @neondatabase/serverless, drizzle-kit)
    UPD   tsconfig.json                  (include drizzle.config.ts)
    GEN   migrations/0000_whole_paibok.sql  (5 tables, applied to Neon)

  packages/config
    UPD   src/env.ts   (apiEnvSchema ← DATABASE_URL, CLERK_SECRET_KEY, ALLOWED_ORIGIN;
                        new webEnvSchema with NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
    UPD   src/index.ts

  packages/types
    NEW   src/api/conversations.ts   (Zod schemas: createConversation, updateConversation,
                                      createMessage, listConversations, listMessages)
    UPD   src/index.ts
    UPD   package.json               (added zod dependency)

  apps/api
    NEW   src/types.ts               (ApiVariables: requestId, clerkUserId, userId, workspaceId)
    NEW   src/middleware/request-id.ts
    NEW   src/middleware/auth.ts     (verifyToken from @clerk/backend)
    NEW   src/middleware/workspace.ts (find-or-create user+workspace; fetches real email from Clerk)
    NEW   src/routes/conversations.ts (GET/POST /v1/conversations, GET+PATCH+DELETE /v1/conversations/:id)
    NEW   src/routes/messages.ts     (GET+POST /v1/conversations/:id/messages)
    UPD   src/index.ts               (CORS, requestId middleware, auth+workspace middleware, v1 router)
    UPD   package.json               (added @clerk/backend, @omnimind/db)

  apps/web
    NEW   src/app/providers.tsx      (ClerkProvider + QueryClientProvider + ReactQueryDevtools)
    UPD   src/app/layout.tsx         (wraps children in Providers)
    UPD   src/components/LayoutContent.tsx   (removed AuthProvider)
    UPD   src/middleware.ts          (Clerk clerkMiddleware + createRouteMatcher)
    UPD   src/app/auth/login/page.tsx        (Clerk <SignIn> component)
    UPD   src/app/auth/signup/page.tsx       (Clerk <SignUp> component)
    UPD   src/app/auth/callback/route.ts     (simple redirect; Clerk handles OAuth natively)
    UPD   src/app/chat/page.tsx              (useAuth → useUser + useClerk)
    UPD   src/app/dashboard/page.tsx         (useAuth → useUser + useClerk, Clerk user shape)
    NEW   src/lib/api/client.ts      (apiFetch: typed fetch with Bearer token + error handling)
    NEW   src/features/conversations/api/conversationsApi.ts
    NEW   src/features/conversations/hooks/useConversations.ts  (TanStack Query)
    NEW   src/features/conversations/hooks/useMessages.ts       (TanStack Query)
    DEL   src/lib/supabase/          (client.ts, server.ts, middleware.ts)
    DEL   src/contexts/AuthContext.tsx
    UPD   package.json               (added @clerk/nextjs, @omnimind/types, @tanstack/react-query-devtools;
                                      removed @supabase/ssr, @supabase/supabase-js)

Validation:
  - pnpm type-check (turbo): 9/9 packages pass
  - pnpm --filter @omnimind/web build: ✓ all 11 pages, clean (Supabase prerender failure resolved)
  - drizzle-kit generate: 5 tables generated → migrations/0000_whole_paibok.sql
  - drizzle-kit migrate: migrations applied to Neon Postgres successfully
  - apps/web next lint: not re-run (no structural changes to lint rules)

Architecture compliance:
  - Route → validation → repository → response pattern followed
  - Shared Zod schemas live in packages/types, not in routes
  - requestId generated per-request and propagated to all error responses
  - Workspace scope enforced: every conversation/message query includes workspaceId
  - Supabase auth fully removed; Clerk is the sole auth provider

Known risks / follow-ups:
  - Workspace provisioning (upsertFromClerk → find workspace → create) is not wrapped
    in a single DB transaction. Concurrent first-time requests could create duplicate
    workspaces. Fix in M2 with a transactional find-or-create helper.
  - authorizedParties not set on Clerk verifyToken — add before production to restrict
    JWTs to specific frontend origins.
  - LocalStorage conversation stores (src/lib/stores/chat.ts etc.) are NOT removed.
    Import/migration path for legacy sessions deferred to M2.
  - apps/web/src/app/api/chat and apps/web/src/app/api/models routes still use old
    direct-provider logic. Migration to backend LLM gateway deferred to M4-M6.

Next recommended task: M2 — Provider Key Vault
  - Add provider_keys table (packages/db)
  - Add encryption abstraction (app-level envelope encryption)
  - Add provider key APIs: list metadata, create/update, delete, validate
  - Update settings UI
  - Add audit_logs table

Docs updated: docs/handoff-m1.md (this file)
