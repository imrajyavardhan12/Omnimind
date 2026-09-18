import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { ApiVariables } from '../../types.js'

const mockConvFindById = vi.fn()
const mockFindWithUsage = vi.fn()
const mockFindFiles = vi.fn()

vi.mock('@omnimind/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@omnimind/db')>()
  return {
    ...original,
    ConversationRepository: class {
      findById = mockConvFindById
    },
    MessageRepository: class {
      findByConversationWithUsage = mockFindWithUsage
    },
    MessageAttachmentRepository: class {
      findFilesByMessageIds = mockFindFiles
    },
  }
})

const { createMessagesRouter } = await import('../messages.js')

const FAKE_DB = {} as never

function buildApp() {
  const app = new Hono<{ Variables: ApiVariables }>()
  app.use('*', async (c, next) => {
    c.set('requestId', 'req-test-1')
    c.set('clerkUserId', 'clerk_1')
    c.set('userId', 'user_1')
    c.set('workspaceId', 'ws_1')
    c.set('userRole', 'member')
    await next()
  })
  app.route('/conversations/:conversationId/messages', createMessagesRouter(FAKE_DB))
  return app
}

describe('messages routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConvFindById.mockResolvedValue({ id: 'conv-1', workspaceId: 'ws-1' })
    mockFindFiles.mockResolvedValue([])
  })

  it('404s for an unknown conversation', async () => {
    mockConvFindById.mockResolvedValue(undefined)
    const res = await buildApp().request('/conversations/missing/messages')
    expect(res.status).toBe(404)
  })

  it('returns messages with grouped attachment metadata in one batched lookup', async () => {
    mockFindWithUsage.mockResolvedValue([
      { id: 'm1', role: 'user', contentText: 'hi' },
      { id: 'm2', role: 'assistant', contentText: 'hello' },
    ])
    mockFindFiles.mockResolvedValue([
      { messageId: 'm1', fileId: 'f1', filename: 'a.pdf', mimeType: 'application/pdf' },
      { messageId: 'm1', fileId: 'f2', filename: 'b.png', mimeType: 'image/png' },
    ])
    const res = await buildApp().request('/conversations/conv-1/messages')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(mockFindFiles).toHaveBeenCalledTimes(1)
    expect(mockFindFiles).toHaveBeenCalledWith(['m1', 'm2'])
    expect(json.messages[0].attachments).toEqual([
      { id: 'f1', filename: 'a.pdf', mimeType: 'application/pdf' },
      { id: 'f2', filename: 'b.png', mimeType: 'image/png' },
    ])
    expect(json.messages[1].attachments).toEqual([])
  })
})
