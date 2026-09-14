import { and, eq, ne, sql } from 'drizzle-orm'
import type { Db } from '../client.js'
import { files, type FileRecord, type NewFileRecord } from '../schema/index.js'

export class FileRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewFileRecord): Promise<FileRecord> {
    const rows = await this.db.insert(files).values(input).returning()
    return rows[0]!
  }

  /** Workspace-scoped lookup; excludes soft-deleted rows. */
  async findById(id: string, workspaceId: string): Promise<FileRecord | undefined> {
    const rows = await this.db
      .select()
      .from(files)
      .where(
        and(
          eq(files.id, id),
          eq(files.workspaceId, workspaceId),
          ne(files.status, 'deleted'),
        ),
      )
      .limit(1)
    return rows[0]
  }

  /**
   * Mark a pending upload verified: the R2 object exists (checked by the
   * caller), so record its hash + authoritative size and move to uploaded.
   * Workspace-scoped; only pending rows transition (idempotent complete).
   */
  async markUploaded(
    id: string,
    workspaceId: string,
    verified: { sha256: string; sizeBytes: number },
  ): Promise<FileRecord | undefined> {
    const rows = await this.db
      .update(files)
      .set({
        status: 'uploaded',
        sha256: verified.sha256,
        sizeBytes: verified.sizeBytes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(files.id, id),
          eq(files.workspaceId, workspaceId),
          eq(files.status, 'pending'),
        ),
      )
      .returning()
    return rows[0]
  }

  /** Transition status (workspace-scoped, not on deleted rows). */
  async updateStatus(
    id: string,
    workspaceId: string,
    status: FileRecord['status'],
  ): Promise<FileRecord | undefined> {
    const rows = await this.db
      .update(files)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(files.id, id),
          eq(files.workspaceId, workspaceId),
          ne(files.status, 'deleted'),
        ),
      )
      .returning()
    return rows[0]
  }

  /** Soft delete: status -> deleted, stamp deleted_at for the retention job. */
  async softDelete(id: string, workspaceId: string): Promise<boolean> {
    const now = new Date()
    const rows = await this.db
      .update(files)
      .set({ status: 'deleted', deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(files.id, id),
          eq(files.workspaceId, workspaceId),
          ne(files.status, 'deleted'),
        ),
      )
      .returning()
    return rows.length > 0
  }

  /** Total bytes of non-deleted files in a workspace, for quota enforcement. */
  async sumActiveSizeBytes(workspaceId: string): Promise<number> {
    const rows = await this.db
      .select({
        total: sql<string>`coalesce(sum(${files.sizeBytes}), 0)`,
      })
      .from(files)
      .where(and(eq(files.workspaceId, workspaceId), ne(files.status, 'deleted')))
    return Number(rows[0]?.total ?? 0)
  }
}
