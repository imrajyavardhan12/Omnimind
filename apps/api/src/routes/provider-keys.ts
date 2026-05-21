import { Hono } from 'hono'
import type { Db } from '@omnimind/db'
import { ProviderKeyRepository, AuditLogRepository } from '@omnimind/db'
import { providerNameSchema, upsertProviderKeySchema } from '@omnimind/types'
import { encryptProviderKey } from '../lib/encryption.js'
import type { ApiVariables } from '../types.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

export function createProviderKeysRouter(db: Db, encryptionSecret: string) {
  const router = new Hono<{ Variables: ApiVariables }>()

  router.get('/', async (c) => {
    const repo = new ProviderKeyRepository(db)
    const keys = await repo.findByWorkspace(c.get('workspaceId'))
    return c.json({ providerKeys: keys })
  })

  router.put('/:provider', async (c) => {
    const rid = c.get('requestId')

    if (!ADMIN_ROLES.has(c.get('userRole'))) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Only owners and admins may manage provider keys', requestId: rid } }, 403)
    }

    const providerParsed = providerNameSchema.safeParse(c.req.param('provider'))
    if (!providerParsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Unknown provider', requestId: rid } }, 400)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = upsertProviderKeySchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', requestId: rid } }, 400)
    }

    const plaintext = parsed.data.key
    const encryptedKey = encryptProviderKey(plaintext, encryptionSecret)
    const keyHint = plaintext.slice(-4)

    const repo = new ProviderKeyRepository(db)
    const providerKey = await repo.upsert({
      workspaceId: c.get('workspaceId'),
      provider: providerParsed.data,
      encryptedKey,
      keyHint,
      createdByUserId: c.get('userId'),
    })

    new AuditLogRepository(db).create({
      workspaceId: c.get('workspaceId'),
      userId: c.get('userId'),
      action: 'provider_key.upsert',
      resourceType: 'provider_key',
      resourceId: providerParsed.data,
    }).catch(() => undefined)

    return c.json({ providerKey }, 200)
  })

  router.delete('/:provider', async (c) => {
    const rid = c.get('requestId')

    if (!ADMIN_ROLES.has(c.get('userRole'))) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Only owners and admins may manage provider keys', requestId: rid } }, 403)
    }

    const providerParsed = providerNameSchema.safeParse(c.req.param('provider'))
    if (!providerParsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Unknown provider', requestId: rid } }, 400)
    }

    const repo = new ProviderKeyRepository(db)
    const deleted = await repo.delete(c.get('workspaceId'), providerParsed.data)
    if (!deleted) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Provider key not found', requestId: rid } }, 404)
    }

    new AuditLogRepository(db).create({
      workspaceId: c.get('workspaceId'),
      userId: c.get('userId'),
      action: 'provider_key.delete',
      resourceType: 'provider_key',
      resourceId: providerParsed.data,
    }).catch(() => undefined)

    return c.json({ success: true })
  })

  return router
}
