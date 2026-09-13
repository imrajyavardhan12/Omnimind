'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProviderName } from '@omnimind/types'

/** A council model selection (the contract submits provider+model SELECTIONS only). */
export interface CouncilModelChoice {
  provider: ProviderName
  /** Catalog model id. */
  model: string
  /** Display name for the UI only. */
  name: string
}

interface CouncilComposerState {
  /** Council members, 2–5 (persisted as a UI preference). */
  councilModels: CouncilModelChoice[]
  /** Chairman selection (persisted as a UI preference). */
  chairmanModel: CouncilModelChoice | null
  /** Active backend council run id — navigation state, NOT canonical data. */
  activeRunId: string | null

  addCouncilModel: (model: CouncilModelChoice) => void
  removeCouncilModel: (provider: ProviderName, model: string) => void
  setChairmanModel: (model: CouncilModelChoice | null) => void
  setActiveRunId: (id: string | null) => void
}

export const MAX_COUNCIL_MODELS = 5
export const MIN_COUNCIL_MODELS = 2

function sameChoice(a: CouncilModelChoice, provider: ProviderName, model: string): boolean {
  return a.provider === provider && a.model === model
}

export function councilModelKey(choice: Pick<CouncilModelChoice, 'provider' | 'model'>): string {
  return `${choice.provider}:${choice.model}`
}

export const useCouncilComposerStore = create<CouncilComposerState>()(
  persist(
    (set, get) => ({
      councilModels: [],
      chairmanModel: null,
      activeRunId: null,

      addCouncilModel: (model) => {
        const { councilModels, chairmanModel } = get()
        if (councilModels.length >= MAX_COUNCIL_MODELS) return
        if (councilModels.some((m) => sameChoice(m, model.provider, model.model))) return
        set({ councilModels: [...councilModels, model] })
        if (councilModels.length === 0 && !chairmanModel) {
          set({ chairmanModel: model })
        }
      },

      removeCouncilModel: (provider, model) =>
        set((state) => {
          const councilModels = state.councilModels.filter((m) => !sameChoice(m, provider, model))
          const chairmanRemoved =
            state.chairmanModel != null && sameChoice(state.chairmanModel, provider, model)
          return {
            councilModels,
            chairmanModel: chairmanRemoved ? (councilModels[0] ?? null) : state.chairmanModel,
          }
        }),

      setChairmanModel: (model) => set({ chairmanModel: model }),
      setActiveRunId: (id) => set({ activeRunId: id }),
    }),
    {
      name: 'omnimind-council-composer',
      // UI preferences + the active-run POINTER only. Run content always loads
      // from GET detail, so a refresh resumes the same run from the server.
      partialize: (state) => ({
        councilModels: state.councilModels,
        chairmanModel: state.chairmanModel,
        activeRunId: state.activeRunId,
      }),
    },
  ),
)
