import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { Db } from '@omnimind/db'
import { ProviderKeyRepository, AuditLogRepository, ModelCatalogService } from '@omnimind/db'
import { gatewayRequestSchema } from '@omnimind/types'
import { LLMGateway } from '@omnimind/ai'
import { decryptProviderKey } from '../lib/encryption.js'
import type { ApiVariables } from '../types.js'

export function createChatStreamRouter(db: Db, encryptionSecret: string) {
  const router = new Hono<{ Variables: ApiVariables }>()

  router.post('/', async (c) => {
    const rid = c.get('requestId')

    const body = await c.req.json().catch(() => null)
    const parsed = gatewayRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body', requestId: rid } },
        400,
      )
    }

    const workspaceId = c.get('workspaceId')
    const keyRepo = new ProviderKeyRepository(db)
    const keyRow = await keyRepo.findEncrypted(workspaceId, parsed.data.provider)
    if (!keyRow) {
      return c.json(
        { error: { code: 'PROVIDER_KEY_MISSING', message: `No provider key configured for ${parsed.data.provider}`, requestId: rid } },
        400,
      )
    }

    let providerKey: string
    try {
      providerKey = decryptProviderKey(keyRow.encryptedKey, encryptionSecret)
    } catch {
      return c.json(
        { error: { code: 'PROVIDER_KEY_INVALID', message: 'Failed to decrypt provider key', requestId: rid } },
        500,
      )
    }

    new AuditLogRepository(db).create({
      workspaceId,
      userId: c.get('userId'),
      action: 'chat.stream.requested',
      resourceType: 'chat_stream',
      resourceId: rid,
    }).catch(() => undefined)

    const gateway = new LLMGateway({ modelCatalogService: new ModelCatalogService(db) })

    const res = streamSSE(c, async (stream) => {
      const chunks = gateway.stream({
        ...parsed.data,
        providerKey,
        abortSignal: c.req.raw.signal,
      })

      for await (const chunk of chunks) {
        await stream.writeSSE({
          event: chunk.type,
          data: JSON.stringify(chunk),
        })
      }
    }, async (err, stream) => {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ type: 'error', error: { code: 'UNKNOWN_PROVIDER_ERROR', message: 'Internal stream error' } }),
      })
    })

    res.headers.set('Cache-Control', 'no-cache, no-transform')
    res.headers.set('X-Accel-Buffering', 'no')
    return res
  })

  return router
}
