'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAvailableModels } from '@/features/models/hooks/useModels'
import { useProviderKeys } from '@/features/provider-keys/hooks/useProviderKeys'
import type { ProviderName } from '@omnimind/types'
import {
  MAX_COMPARE_MODELS,
  useRunComposerStore,
  type RunModelChoice,
} from '../state/runComposerStore'

const SEP = ':::'
const choiceValue = (provider: string, model: string) => `${provider}${SEP}${model}`

/**
 * Lists catalog models and writes selections to the run composer store.
 * Selection is NOT gated on client-side keys — the backend resolves the
 * server-side key and surfaces a per-model PROVIDER_KEY_MISSING error if absent.
 * Providers with a saved key are flagged for guidance only.
 */
export function RunModelPicker({ mode }: { mode: 'single' | 'compare' }) {
  const { models } = useAvailableModels({ enabledOnly: true })
  const { data: providerKeys } = useProviderKeys()
  const { singleModel, compareModels, setSingleModel, addCompareModel, removeCompareModel } =
    useRunComposerStore()
  // Remount key so the "add a model" select returns to its placeholder after
  // each add instead of showing the just-picked model (it holds no selection).
  const [addKey, setAddKey] = useState(0)

  const connectedProviders = useMemo(
    () => new Set((providerKeys ?? []).map((k) => k.provider)),
    [providerKeys],
  )

  const findModel = (value: string): RunModelChoice | null => {
    const [provider, model] = value.split(SEP)
    const entry = models.find((m) => m.provider === provider && m.id === model)
    if (!entry) return null
    return { provider: entry.provider as ProviderName, model: entry.id, name: entry.name }
  }

  if (mode === 'single') {
    return (
      <div className="flex items-center gap-2">
        <Select
          value={singleModel ? choiceValue(singleModel.provider, singleModel.model) : undefined}
          onValueChange={(value) => setSingleModel(findModel(value))}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={choiceValue(m.provider, m.id)} value={choiceValue(m.provider, m.id)}>
                {m.name}
                {!connectedProviders.has(m.provider as ProviderName) ? ' — no key' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  const canAddMore = compareModels.length < MAX_COMPARE_MODELS

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {compareModels.map((m) => (
          <span
            key={choiceValue(m.provider, m.model)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
          >
            {m.name}
            <button
              type="button"
              aria-label={`Remove ${m.name}`}
              onClick={() => removeCompareModel(m.provider, m.model)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Select
        key={addKey}
        value={undefined}
        onValueChange={(value) => {
          const choice = findModel(value)
          if (choice) {
            addCompareModel(choice)
            setAddKey((k) => k + 1)
          }
        }}
        disabled={!canAddMore}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder={canAddMore ? 'Add a model to compare' : 'Max 5 models'} />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={choiceValue(m.provider, m.id)} value={choiceValue(m.provider, m.id)}>
              {m.name}
              {!connectedProviders.has(m.provider as ProviderName) ? ' — no key' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
