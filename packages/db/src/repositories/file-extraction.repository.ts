import { desc, eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import {
  fileExtractions,
  type FileExtraction,
  type NewFileExtraction,
} from '../schema/index.js'

/**
 * Extraction records are append-only: every extraction attempt writes a row
 * and the latest row is the current truth. Re-running extraction (e.g. after
 * a crash left the file `processing`, or an explicit `complete` retry on a
 * `failed` file) adds a row rather than overwriting history.
 */
export class FileExtractionRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewFileExtraction): Promise<FileExtraction> {
    const rows = await this.db.insert(fileExtractions).values(input).returning()
    return rows[0]!
  }

  async updateStatus(
    id: string,
    status: FileExtraction['status'],
    fields?: { outputText?: string; outputStorageKey?: string; errorMessage?: string },
  ): Promise<FileExtraction | undefined> {
    const rows = await this.db
      .update(fileExtractions)
      .set({
        status,
        updatedAt: new Date(),
        ...(fields?.outputText !== undefined && { outputText: fields.outputText }),
        ...(fields?.outputStorageKey !== undefined && { outputStorageKey: fields.outputStorageKey }),
        ...(fields?.errorMessage !== undefined && { errorMessage: fields.errorMessage }),
      })
      .where(eq(fileExtractions.id, id))
      .returning()
    return rows[0]
  }

  async findLatestByFileId(fileId: string): Promise<FileExtraction | undefined> {
    const rows = await this.db
      .select()
      .from(fileExtractions)
      .where(eq(fileExtractions.fileId, fileId))
      .orderBy(desc(fileExtractions.createdAt))
      .limit(1)
    return rows[0]
  }
}
