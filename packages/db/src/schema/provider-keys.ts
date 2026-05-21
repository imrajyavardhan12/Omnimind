import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { appUsers } from './users.js'
import { workspaces } from './workspaces.js'

export const PROVIDER_NAMES = ['openai', 'anthropic', 'gemini', 'openrouter', 'google-ai-studio'] as const
export type ProviderKeyName = (typeof PROVIDER_NAMES)[number]

export const providerKeys = pgTable('provider_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  provider: text('provider').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  keyHint: text('key_hint'),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => appUsers.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('provider_keys_workspace_provider_idx').on(table.workspaceId, table.provider),
])

export type ProviderKey = typeof providerKeys.$inferSelect
export type NewProviderKey = typeof providerKeys.$inferInsert
