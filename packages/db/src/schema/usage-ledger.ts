import { index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { appUsers } from './users.js'
import { workspaces } from './workspaces.js'
import { conversations } from './conversations.js'
import { chatRuns, chatModelRuns } from './chat-runs.js'

export const usageLedger = pgTable('usage_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => appUsers.id),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  chatRunId: uuid('chat_run_id').references(() => chatRuns.id),
  chatModelRunId: uuid('chat_model_run_id').references(() => chatModelRuns.id),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  usageSource: text('usage_source', { enum: ['provider', 'estimated'] }).notNull(),
  costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('usage_ledger_workspace_idx').on(table.workspaceId, table.createdAt.desc()),
])

export type UsageLedgerEntry = typeof usageLedger.$inferSelect
export type NewUsageLedgerEntry = typeof usageLedger.$inferInsert
