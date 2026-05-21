import { and, eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import { modelCatalog, type ModelCatalogEntry, type NewModelCatalogEntry } from '../schema/index.js'

export interface ModelCatalogFilters {
  provider?: string
  enabledOnly?: boolean
  supportsVision?: boolean
  supportsTools?: boolean
  supportsJson?: boolean
  supportsFiles?: boolean
  supportsStreaming?: boolean
}

export class ModelCatalogRepository {
  constructor(private readonly db: Db) {}

  async findAll(filters: ModelCatalogFilters = {}): Promise<ModelCatalogEntry[]> {
    const conditions = []

    if (filters.provider !== undefined) {
      conditions.push(eq(modelCatalog.provider, filters.provider))
    }
    if (filters.enabledOnly) {
      conditions.push(eq(modelCatalog.isEnabled, true))
      conditions.push(eq(modelCatalog.isDeprecated, false))
    }
    if (filters.supportsVision) {
      conditions.push(eq(modelCatalog.supportsVision, true))
    }
    if (filters.supportsTools) {
      conditions.push(eq(modelCatalog.supportsTools, true))
    }
    if (filters.supportsJson) {
      conditions.push(eq(modelCatalog.supportsJson, true))
    }
    if (filters.supportsFiles) {
      conditions.push(eq(modelCatalog.supportsFiles, true))
    }
    if (filters.supportsStreaming) {
      conditions.push(eq(modelCatalog.supportsStreaming, true))
    }

    return this.db
      .select()
      .from(modelCatalog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(modelCatalog.provider, modelCatalog.modelId)
  }

  async findByProviderModel(provider: string, modelId: string): Promise<ModelCatalogEntry | undefined> {
    const rows = await this.db
      .select()
      .from(modelCatalog)
      .where(and(eq(modelCatalog.provider, provider), eq(modelCatalog.modelId, modelId)))
      .limit(1)
    return rows[0]
  }

  async upsert(entry: NewModelCatalogEntry): Promise<ModelCatalogEntry> {
    const rows = await this.db
      .insert(modelCatalog)
      .values(entry)
      .onConflictDoUpdate({
        target: [modelCatalog.provider, modelCatalog.modelId],
        set: {
          displayName: entry.displayName,
          description: entry.description,
          contextWindow: entry.contextWindow,
          maxOutputTokens: entry.maxOutputTokens,
          inputCostPer1m: entry.inputCostPer1m,
          outputCostPer1m: entry.outputCostPer1m,
          supportsStreaming: entry.supportsStreaming,
          supportsVision: entry.supportsVision,
          supportsTools: entry.supportsTools,
          supportsJson: entry.supportsJson,
          supportsFiles: entry.supportsFiles,
          speedTier: entry.speedTier,
          qualityTier: entry.qualityTier,
          isEnabled: entry.isEnabled,
          isDeprecated: entry.isDeprecated,
          metadataJson: entry.metadataJson,
          updatedAt: new Date(),
        },
      })
      .returning()
    return rows[0]!
  }
}
