import { Hono } from 'hono'
import type { Db } from '@omnimind/db'
import { ConversationRepository, MessageAttachmentRepository, MessageRepository } from '@omnimind/db'
import { createMessageSchema, listMessagesQuerySchema } from '@omnimind/types'
import type { ApiVariables } from '../types.js'

export function createMessagesRouter(db: Db) {
  const router = new Hono<{ Variables: ApiVariables }>()

  router.get('/', async (c) => {
    const rid = c.get('requestId')
    const conversationId = c.req.param('conversationId') as string
    const query = listMessagesQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    )
    if (!query.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: query.error.message, requestId: rid } }, 400)
    }

    const convRepo = new ConversationRepository(db)
    const conversation = await convRepo.findById(conversationId, c.get('workspaceId'))
    if (!conversation) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found', requestId: rid } }, 404)
    }

    const msgRepo = new MessageRepository(db)
    const items = await msgRepo.findByConversationWithUsage(conversationId, c.get('workspaceId'), query.data.limit)

    // Attachment chips for history display: one batched join for the page.
    const attachmentRepo = new MessageAttachmentRepository(db)
    const links = await attachmentRepo.findFilesByMessageIds(items.map((m) => m.id))
    const byMessage = new Map<string, { id: string; filename: string; mimeType: string }[]>()
    for (const link of links) {
      const list = byMessage.get(link.messageId) ?? []
      list.push({ id: link.fileId, filename: link.filename, mimeType: link.mimeType })
      byMessage.set(link.messageId, list)
    }
    return c.json({
      messages: items.map((m) => ({ ...m, attachments: byMessage.get(m.id) ?? [] })),
    })
  })

  router.post('/', async (c) => {
    const rid = c.get('requestId')
    const conversationId = c.req.param('conversationId') as string
    const body = await c.req.json().catch(() => null)
    const parsed = createMessageSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message, requestId: rid } }, 400)
    }

    const convRepo = new ConversationRepository(db)
    const conversation = await convRepo.findById(conversationId, c.get('workspaceId'))
    if (!conversation) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found', requestId: rid } }, 404)
    }

    const msgRepo = new MessageRepository(db)
    const message = await msgRepo.create({
      conversationId,
      workspaceId: c.get('workspaceId'),
      role: parsed.data.role,
      contentText: parsed.data.contentText,
      provider: parsed.data.provider ?? null,
      model: parsed.data.model ?? null,
      createdByUserId: parsed.data.role === 'user' ? c.get('userId') : null,
    })
    return c.json({ message }, 201)
  })

  return router
}
