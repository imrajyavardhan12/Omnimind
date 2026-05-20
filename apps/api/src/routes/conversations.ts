import { Hono } from 'hono'
import type { Db } from '@omnimind/db'
import { ConversationRepository } from '@omnimind/db'
import {
  createConversationSchema,
  updateConversationSchema,
  listConversationsQuerySchema,
} from '@omnimind/types'
import type { ApiVariables } from '../types.js'

export function createConversationsRouter(db: Db) {
  const router = new Hono<{ Variables: ApiVariables }>()

  router.get('/', async (c) => {
    const rid = c.get('requestId')
    const query = listConversationsQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    )
    if (!query.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: query.error.message, requestId: rid } }, 400)
    }

    const repo = new ConversationRepository(db)
    const items = await repo.findByWorkspace(c.get('workspaceId'), query.data.limit, query.data.status)
    return c.json({ conversations: items })
  })

  router.post('/', async (c) => {
    const rid = c.get('requestId')
    const body = await c.req.json().catch(() => null)
    const parsed = createConversationSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message, requestId: rid } }, 400)
    }

    const repo = new ConversationRepository(db)
    const conversation = await repo.create({
      workspaceId: c.get('workspaceId'),
      createdByUserId: c.get('userId'),
      title: parsed.data.title,
      mode: parsed.data.mode,
    })
    return c.json({ conversation }, 201)
  })

  router.get('/:id', async (c) => {
    const rid = c.get('requestId')
    const repo = new ConversationRepository(db)
    const conversation = await repo.findById(c.req.param('id'), c.get('workspaceId'))
    if (!conversation) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found', requestId: rid } }, 404)
    }
    return c.json({ conversation })
  })

  router.patch('/:id', async (c) => {
    const rid = c.get('requestId')
    const body = await c.req.json().catch(() => null)
    const parsed = updateConversationSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message, requestId: rid } }, 400)
    }

    const repo = new ConversationRepository(db)
    const conversation = await repo.update(c.req.param('id'), c.get('workspaceId'), parsed.data)
    if (!conversation) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found', requestId: rid } }, 404)
    }
    return c.json({ conversation })
  })

  router.delete('/:id', async (c) => {
    const rid = c.get('requestId')
    const repo = new ConversationRepository(db)
    const deleted = await repo.softDelete(c.req.param('id'), c.get('workspaceId'))
    if (!deleted) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found', requestId: rid } }, 404)
    }
    return c.json({ success: true })
  })

  return router
}
