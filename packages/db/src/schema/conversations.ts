import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { appUsers } from './users.js'
import { workspaces } from './workspaces.js'

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => appUsers.id),
  title: text('title').notNull(),
  mode: text('mode', { enum: ['single', 'compare', 'council'] })
    .notNull()
    .default('single'),
  status: text('status', { enum: ['active', 'archived', 'deleted'] })
    .notNull()
    .default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  role: text('role', { enum: ['user', 'assistant', 'system', 'tool'] }).notNull(),
  contentText: text('content_text').notNull(),
  modelRunId: uuid('model_run_id'),
  provider: text('provider'),
  model: text('model'),
  createdByUserId: uuid('created_by_user_id').references(() => appUsers.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
