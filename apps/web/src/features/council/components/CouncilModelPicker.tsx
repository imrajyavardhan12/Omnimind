'use client'

import { useMemo, useState } from 'react'
import { Crown, Plus, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAvailableModels } from '@/features/models/hooks/useModels'
import { useProviderKeys } from '@/features/provider-keys/hooks/useProviderKeys'
import type { ProviderName } from '@omnimind/types'
import {
  MAX_COUNCIL_MODELS,
  councilModelKey,
  useCouncilComposerStore,
  type CouncilModelChoice,
} from '../state/councilComposerStore'
import { cn } from '@/lib/utils'

const SEP = ':::'
const choiceValue = (provider: string, model: string) => `${provider}${SEP}${model}`

const PROVIDER_DOT: Record<string, string> = {
  openai: 'bg-green-500',
  anthropic: 'bg-orange-500',
  'google-ai-studio': 'bg-blue-500',
  gemini: 'bg-blue-500',
  openrouter: 'bg-purple-500',
}

/**
 * Council member multi-select + chairman select, catalog-driven.
 * Selection is NOT gated on keys — the backend resolves the server-side key
 * and surfaces per-model PROVIDER_KEY_MISSING; providers without a saved key
 * are annotated for guidance only (same contract as RunModelPicker).
 */
export function CouncilModelPicker() {
  const { models } = useAvailableModels({ enabledOnly: true })
  const { data: providerKeys } = useProviderKeys()
  const { councilModels, chairmanModel, addCouncilModel, removeCouncilModel, setChairmanModel } =
    useCouncilComposerStore()
  const [addKey, setAddKey] = useState(0)

  const connectedProviders = useMemo(
    () => new Set((providerKeys ?? []).map((k) => k.provider)),
    [providerKeys],
  )

  const findChoice = (value: string): CouncilModelChoice | null => {
    const [provider, model] = value.split(SEP)
    const entry = models.find((m) => m.provider === provider && m.id === model)
    if (!entry) return null
    return { provider: entry.provider as ProviderName, model: entry.id, name: entry.name }
  }

  const candidates = models.filter(
    (m) => !councilModels.some((cm) => councilModelKey(cm) === `${m.provider}:${m.id}`),
  )

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          Council Members{' '}
          <span className="text-xs text-muted-foreground font-normal">
            ({councilModels.length} / {MAX_COUNCIL_MODELS} max, min 2)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {councilModels.map((m) => {
            const isChairman =
              chairmanModel != null && councilModelKey(chairmanModel) === councilModelKey(m)
            return (
              <div
                key={councilModelKey(m)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
                  isChairman ? 'bg-primary/10 border-primary/50' : 'bg-muted/30 border-border',
                )}
              >
                <div className={cn('w-2 h-2 rounded-full', PROVIDER_DOT[m.provider] ?? 'bg-gray-500')} />
                <span className="font-medium">{m.name}</span>
                {isChairman && <Crown className="w-3 h-3 text-primary" />}
                <button
                  onClick={() => removeCouncilModel(m.provider, m.model)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${m.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )
          })}
          {councilModels.length < MAX_COUNCIL_MODELS && (
            <Select
              key={addKey}
              onValueChange={(value) => {
                const choice = findChoice(value)
                if (choice) {
                  addCouncilModel(choice)
                  setAddKey((k) => k + 1)
                }
              }}
            >
              <SelectTrigger className="w-[200px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Plus className="w-3 h-3" /> Add member
                </span>
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={choiceValue(m.provider, m.id)} value={choiceValue(m.provider, m.id)}>
                    {m.name}
                    {!connectedProviders.has(m.provider as ProviderName) ? ' — no key' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Chairman</div>
        <Select
          value={chairmanModel ? choiceValue(chairmanModel.provider, chairmanModel.model) : undefined}
          onValueChange={(value) => setChairmanModel(findChoice(value))}
        >
          <SelectTrigger className="w-[280px]">
            {chairmanModel ? (
              <span className="flex items-center gap-2">
                <Crown className="w-3 h-3 text-primary" /> {chairmanModel.name}
              </span>
            ) : (
              <span className="text-muted-foreground">Select chairman</span>
            )}
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
    </div>
  )
}
