import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { appUsers } from './users.js'
import { workspaces } from './workspaces.js'
import { conversations, messages } from './conversations.js'

export const chatRuns = pgTable(
  'chat_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => appUsers.id),
    inputMessageId: uuid('input_message_id').references(() => messages.id),
    mode: text('mode', { enum: ['single', 'compare'] }).notNull().default('single'),
    status: text('status', {
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('queued'),
    idempotencyKey: text('idempotency_key'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('chat_runs_idempotency_key_idx')
      .on(table.workspaceId, table.idempotencyKey),
    index('chat_runs_conversation_idx')
      .on(table.conversationId, table.createdAt.desc()),
  ],
)

export const chatModelRuns = pgTable('chat_model_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatRunId: uuid('chat_run_id')
    .notNull()
    .references(() => chatRuns.id),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  status: text('status', {
    enum: ['queued', 'running', 'retrying', 'completed', 'failed', 'cancelled'],
  })
    .notNull()
    .default('queued'),
  settingsJson: jsonb('settings_json'),
  outputMessageId: uuid('output_message_id').references(() => messages.id),
  providerRequestId: text('provider_request_id'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  totalTokens: integer('total_tokens'),
  usageSource: text('usage_source', { enum: ['provider', 'estimated'] }),
  costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
  latencyMs: integer('latency_ms'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('chat_model_runs_chat_run_idx').on(table.chatRunId),
])

export const chatRunEvents = pgTable('chat_run_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatRunId: uuid('chat_run_id')
    .notNull()
    .references(() => chatRuns.id),
  sequence: integer('sequence').notNull(),
  eventType: text('event_type').notNull(),
  payloadJson: jsonb('payload_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('chat_run_events_run_sequence_idx').on(table.chatRunId, table.sequence),
])

export type ChatRun = typeof chatRuns.$inferSelect
export type NewChatRun = typeof chatRuns.$inferInsert
export type ChatModelRun = typeof chatModelRuns.$inferSelect
export type NewChatModelRun = typeof chatModelRuns.$inferInsert
export type ChatRunEvent = typeof chatRunEvents.$inferSelect
export type NewChatRunEvent = typeof chatRunEvents.$inferInsert
