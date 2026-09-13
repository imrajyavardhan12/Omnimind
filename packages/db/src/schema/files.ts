import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { appUsers } from './users.js'
import { workspaces } from './workspaces.js'
import { messages } from './conversations.js'

/**
 * Durable file metadata. The file *payload* lives in Cloudflare R2
 * (storage_bucket + storage_key); Postgres holds only metadata + the R2 object
 * key. See docs/architecture/12-file-pipeline.md and ADR 0007.
 *
 * Status lifecycle:
 *   pending    row created, awaiting the client's direct upload to R2 (M7B).
 *   uploaded   client signalled completion; object present in R2 (M7B verifies).
 *   processing extraction running (M7C, inline).
 *   ready      usable by chat runs.
 *   failed     upload or extraction failed.
 *   deleted    soft-deleted (deleted_at set); object cleaned up by a later retention job.
 */
export const files = pgTable(
  'files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => appUsers.id),
    storageBucket: text('storage_bucket').notNull(),
    storageKey: text('storage_key').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    // bigint (mode: number) so future large media (video) does not overflow int4.
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    sha256: text('sha256'),
    status: text('status', {
      enum: ['pending', 'uploaded', 'processing', 'ready', 'failed', 'deleted'],
    })
      .notNull()
      .default('pending'),
    extractedTextKey: text('extracted_text_key'),
    metadataJson: jsonb('metadata_json'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('files_workspace_idx').on(table.workspaceId, table.createdAt.desc()),
  ],
)

/**
 * Per-file extraction record. One file can be extracted with one or more
 * strategies; the chosen strategy is keyed by MIME type. Populated by the inline
 * extractor in M7C; the table lands in M7A so the schema is one coherent unit.
 */
export const fileExtractions = pgTable(
  'file_extractions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id),
    status: text('status', {
      enum: ['queued', 'running', 'completed', 'failed'],
    })
      .notNull()
      .default('queued'),
    extractionType: text('extraction_type', {
      enum: ['pdf_text', 'docx_text', 'passthrough', 'ocr', 'transcription'],
    }).notNull(),
    outputText: text('output_text'),
    outputStorageKey: text('output_storage_key'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('file_extractions_file_idx').on(table.fileId)],
)

/**
 * Join table linking a persisted message to the file(s) attached to it.
 * attachment_role distinguishes a user upload from a model-input reference or a
 * model-generated output. Written by the run engine in M7D (composer uploads
 * before run creation, then the run links files to the user message).
 */
export const messageAttachments = pgTable(
  'message_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id),
    attachmentRole: text('attachment_role', {
      enum: ['user_upload', 'model_input', 'generated_output'],
    })
      .notNull()
      .default('user_upload'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('message_attachments_message_idx').on(table.messageId)],
)

export type FileRecord = typeof files.$inferSelect
export type NewFileRecord = typeof files.$inferInsert
export type FileExtraction = typeof fileExtractions.$inferSelect
export type NewFileExtraction = typeof fileExtractions.$inferInsert
export type MessageAttachment = typeof messageAttachments.$inferSelect
export type NewMessageAttachment = typeof messageAttachments.$inferInsert
