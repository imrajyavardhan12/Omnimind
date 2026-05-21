import { Hono } from 'hono'
import type { Db, ModelCatalogFilters } from '@omnimind/db'
import { ModelCatalogService } from '@omnimind/db'
import { listModelsQuerySchema } from '@omnimind/types'
import type { ApiVariables } from '../types.js'

export function createModelsRouter(db: Db) {
  const router = new Hono<{ Variables: ApiVariables }>()
  const service = new ModelCatalogService(db)

  const capabilityToFilter: Record<string, keyof ModelCatalogFilters> = {
    vision: 'supportsVision',
    tools: 'supportsTools',
    json: 'supportsJson',
    files: 'supportsFiles',
    streaming: 'supportsStreaming',
  }

  router.get('/', async (c) => {
    const rid = c.get('requestId')
    const parsed = listModelsQuerySchema.safeParse({
      provider: c.req.query('provider'),
      capability: c.req.query('capability'),
      enabledOnly: c.req.query('enabledOnly') ?? 'true',
    })

    if (!parsed.success) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', requestId: rid } },
        400,
      )
    }

    const { provider, capability, enabledOnly } = parsed.data

    const filters: ModelCatalogFilters = {
      provider,
      enabledOnly,
      ...(capability && capabilityToFilter[capability] ? { [capabilityToFilter[capability]]: true } : {}),
    }

    const models = await service.listModels(filters)

    return c.json({ models })
  })

  return router
}
