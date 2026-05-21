import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const modelCatalog = pgTable(
  'model_catalog',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull(),
    modelId: text('model_id').notNull(),
    displayName: text('display_name').notNull(),
    description: text('description'),
    contextWindow: integer('context_window').notNull(),
    maxOutputTokens: integer('max_output_tokens').notNull(),
    // Stored and returned as strings to preserve decimal precision for cost accounting
    inputCostPer1m: numeric('input_cost_per_1m', { precision: 12, scale: 6 }).notNull(),
    outputCostPer1m: numeric('output_cost_per_1m', { precision: 12, scale: 6 }).notNull(),
    supportsStreaming: boolean('supports_streaming').notNull().default(true),
    supportsVision: boolean('supports_vision').notNull().default(false),
    supportsTools: boolean('supports_tools').notNull().default(false),
    supportsJson: boolean('supports_json').notNull().default(false),
    supportsFiles: boolean('supports_files').notNull().default(false),
    // speed_tier: fast | medium | slow
    speedTier: text('speed_tier'),
    // quality_tier: frontier | standard | economy
    qualityTier: text('quality_tier'),
    isEnabled: boolean('is_enabled').notNull().default(true),
    isDeprecated: boolean('is_deprecated').notNull().default(false),
    metadataJson: text('metadata_json'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('model_catalog_provider_model_idx').on(table.provider, table.modelId),
  ],
)

export type ModelCatalogEntry = typeof modelCatalog.$inferSelect
export type NewModelCatalogEntry = typeof modelCatalog.$inferInsert
