import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { appUsers } from './users.js'
import { workspaces } from './workspaces.js'
import { conversations } from './conversations.js'

/**
 * Durable Council Mode workflow state (docs/architecture/13-council-workflow.md).
 *
 * A council run is a multi-stage backend workflow, not a frontend sequence:
 *   stage1  each council model answers the query independently
 *   stage2  each model peer-reviews the ANONYMIZED answers (labels A/B/C…,
 *           never provider/model identity) and emits a FINAL RANKING section
 *   stage3  rankings are aggregated (Borda + average) and the chairman model
 *           synthesizes the final report
 *
 * Individual responses, reviews, and the synthesis are persisted as
 * council_stage_results rows as each stage lands, so a run survives browser
 * reloads, disconnects, and partial model failures. Usage/cost per model call
 * goes to the shared usage_ledger (as with chat_model_runs) in M8B.
 */
export const councilRuns = pgTable(
  'council_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    conversationId: uuid('conversation_id').references(() => conversations.id),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => appUsers.id),
    query: text('query').notNull(),
    chairmanProvider: text('chairman_provider').notNull(),
    chairmanModel: text('chairman_model').notNull(),
    status: text('status', {
      enum: ['queued', 'stage1', 'stage2', 'stage3', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('queued'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('council_runs_workspace_idx').on(table.workspaceId, table.createdAt.desc()),
  ],
)

/**
 * One durable record per stage output. Stage 1/2 write one row per model
 * (model_provider/model_id set); aggregation and synthesis write run-level
 * rows (model columns null). payload_json shapes are versioned Zod contracts
 * in @omnimind/types (api/council.ts) — see prompt_version fields there.
 */
export const councilStageResults = pgTable(
  'council_stage_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    councilRunId: uuid('council_run_id')
      .notNull()
      .references(() => councilRuns.id),
    stage: text('stage', { enum: ['stage1', 'stage2', 'stage3'] }).notNull(),
    modelProvider: text('model_provider'),
    modelId: text('model_id'),
    payloadJson: jsonb('payload_json'),
    status: text('status', {
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('queued'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('council_stage_results_run_idx').on(table.councilRunId)],
)

export type CouncilRun = typeof councilRuns.$inferSelect
export type NewCouncilRun = typeof councilRuns.$inferInsert
export type CouncilStageResult = typeof councilStageResults.$inferSelect
export type NewCouncilStageResult = typeof councilStageResults.$inferInsert
