import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { appUsers } from './users.js'
import { workspaces } from './workspaces.js'

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => appUsers.id),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
