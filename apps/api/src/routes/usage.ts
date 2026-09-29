import { Hono } from 'hono'
import type { Db } from '@omnimind/db'
import { UsageLedgerRepository } from '@omnimind/db'
import { usageLedgerQuerySchema, usageSummaryQuerySchema } from '@omnimind/types'
import { getMonthStartUTC } from '../lib/budget.js'
import { summarizeUsage } from '../lib/usage.js'
import type { ApiVariables } from '../types.js'

export function createUsageRouter(db: Db) {
  const router = new Hono<{ Variables: ApiVariables }>()

  // GET /v1/usage/summary — aggregated spend for a window (11-api-design.md).
  // Defaults to the current UTC month; costs keep 6dp ledger precision.
  router.get('/summary', async (c) => {
    const rid = c.get('requestId')
    const parsed = usageSummaryQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    )
    if (!parsed.success) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid query parameters', requestId: rid } },
        400,
      )
    }

    const now = new Date()
    const from = parsed.data.from ? new Date(parsed.data.from) : getMonthStartUTC(now)
    const to = parsed.data.to ? new Date(parsed.data.to) : now
    const rows = await new UsageLedgerRepository(db).getSummary(c.get('workspaceId'), from, to)
    return c.json(summarizeUsage(rows, from, to))
  })

  // GET /v1/usage/ledger — raw append-only entries, newest first (11-api-design.md).
  router.get('/ledger', async (c) => {
    const rid = c.get('requestId')
    const parsed = usageLedgerQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    )
    if (!parsed.success) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid query parameters', requestId: rid } },
        400,
      )
    }

    const entries = await new UsageLedgerRepository(db).findByWorkspace(c.get('workspaceId'), {
      ...(parsed.data.provider !== undefined && { provider: parsed.data.provider }),
      ...(parsed.data.model !== undefined && { model: parsed.data.model }),
      limit: parsed.data.limit,
    })
    // DTO: storage internals stay server-side; cost keeps decimal precision.
    return c.json({
      entries: entries.map((e) => ({
        id: e.id,
        provider: e.provider,
        model: e.model,
        inputTokens: e.inputTokens,
        outputTokens: e.outputTokens,
        totalTokens: e.totalTokens,
        usageSource: e.usageSource,
        costUsd: e.costUsd,
        conversationId: e.conversationId,
        chatRunId: e.chatRunId,
        createdAt: e.createdAt.toISOString(),
      })),
    })
  })

  return router
}
