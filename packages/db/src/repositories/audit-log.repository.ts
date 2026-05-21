import { desc, eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import { auditLogs, type AuditLog, type NewAuditLog } from '../schema/index.js'

export class AuditLogRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewAuditLog): Promise<AuditLog> {
    const rows = await this.db.insert(auditLogs).values(input).returning()
    return rows[0]!
  }

  async findByWorkspace(workspaceId: string, limit = 100): Promise<AuditLog[]> {
    return this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.workspaceId, workspaceId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
  }
}
