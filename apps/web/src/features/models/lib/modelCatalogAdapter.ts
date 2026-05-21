import type { Model } from '@/lib/types'
import type { VerifiedModel } from '@/lib/models/verified-models'
import type { ModelCatalogEntryResponse } from '@omnimind/types'

function costPer1mToCostPer1k(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed / 1000 : 0
}

function speedTierToLegacySpeed(speedTier: string | null): VerifiedModel['speed'] {
  switch (speedTier) {
    case 'fast':
      return 'fast'
    case 'slow':
      return 'slow'
    default:
      return 'medium'
  }
}

function tagsForModel(entry: ModelCatalogEntryResponse): string[] {
  const tags: string[] = [entry.provider]

  if (entry.supportsVision) tags.push('vision')
  if (entry.supportsStreaming) tags.push('streaming')
  if (entry.supportsTools) tags.push('tools')
  if (entry.supportsJson) tags.push('json')
  if (entry.supportsFiles) tags.push('files')
  if (entry.speedTier === 'fast') tags.push('fast')
  if (entry.qualityTier === 'frontier') tags.push('recommended', 'best-quality')
  if (entry.qualityTier === 'economy') tags.push('cheap')
  if (entry.provider === 'google-ai-studio') tags.push('free-tier')
  if (entry.inputCostPer1m === '0.000000' && entry.outputCostPer1m === '0.000000') tags.push('free')
  if (entry.isDeprecated) tags.push('deprecated')

  return Array.from(new Set(tags))
}

export function modelCatalogEntryToModel(entry: ModelCatalogEntryResponse): VerifiedModel {
  return {
    id: entry.modelId,
    name: entry.displayName,
    provider: entry.provider,
    description: entry.description ?? undefined,
    contextLength: entry.contextWindow,
    inputCost: costPer1mToCostPer1k(entry.inputCostPer1m),
    outputCost: costPer1mToCostPer1k(entry.outputCostPer1m),
    supportsFiles: entry.supportsFiles,
    capabilities: {
      vision: entry.supportsVision,
      streaming: entry.supportsStreaming,
      jsonMode: entry.supportsJson,
      functionCalling: entry.supportsTools,
    },
    speed: speedTierToLegacySpeed(entry.speedTier),
    tags: tagsForModel(entry),
    recommended: entry.qualityTier === 'frontier',
  }
}

export function modelCatalogEntriesToModels(entries: ModelCatalogEntryResponse[] | undefined): Model[] {
  return (entries ?? []).map(modelCatalogEntryToModel)
}
