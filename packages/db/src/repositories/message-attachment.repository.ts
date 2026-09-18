import { eq, inArray } from 'drizzle-orm'
import type { Db } from '../client.js'
import { files, messageAttachments } from '../schema/index.js'

/** Attachment metadata for history display (never storage internals). */
export interface MessageAttachmentFile {
  messageId: string
  fileId: string
  filename: string
  mimeType: string
}

/**
 * Read side of the message↔file link (writes ride the atomic run-setup batch
 * in ChatRunWriteRepository). One batched join serves a whole message list —
 * no per-message queries. Callers only pass message ids from a conversation
 * they already workspace-authorized, so links inherit that scope.
 */
export class MessageAttachmentRepository {
  constructor(private readonly db: Db) {}

  async findFilesByMessageIds(messageIds: string[]): Promise<MessageAttachmentFile[]> {
    if (messageIds.length === 0) return []
    return this.db
      .select({
        messageId: messageAttachments.messageId,
        fileId: messageAttachments.fileId,
        filename: files.filename,
        mimeType: files.mimeType,
      })
      .from(messageAttachments)
      .innerJoin(files, eq(messageAttachments.fileId, files.id))
      .where(inArray(messageAttachments.messageId, messageIds))
  }
}
