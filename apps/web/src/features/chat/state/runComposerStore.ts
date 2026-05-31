'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProviderName } from '@omnimind/types'

/** A user model selection (the contract submits provider+model SELECTIONS only). */
export interface RunModelChoice {
  provider: ProviderName
  /** Catalog model id (chatRunModelConfigSchema.model). */
  model: string
  /** Display name for the UI only. */
  name: string
}

interface RunComposerState {
  /**
   * Pointer to the active server conversation. NOT canonical data — messages
   * always load from the API (useMessages). Persisted as navigation state so a
   * refresh reloads the SAME conversation from the API; a stale pointer (e.g. the
   * conversation was deleted) just yields an empty history that "New chat" clears.
   */
  activeConversationId: string | null
  /** Single-mode selection (persisted as a UI preference). */
  singleModel: RunModelChoice | null
  /** Compare-mode selections, up to 5 (persisted as a UI preference). */
  compareModels: RunModelChoice[]

  setActiveConversationId: (id: string | null) => void
  setSingleModel: (model: RunModelChoice | null) => void
  addCompareModel: (model: RunModelChoice) => void
  removeCompareModel: (provider: ProviderName, model: string) => void
}

const MAX_COMPARE_MODELS = 5

function sameChoice(a: RunModelChoice, provider: ProviderName, model: string): boolean {
  return a.provider === provider && a.model === model
}

export const useRunComposerStore = create<RunComposerState>()(
  persist(
    (set, get) => ({
      activeConversationId: null,
      singleModel: null,
      compareModels: [],

      setActiveConversationId: (id) => set({ activeConversationId: id }),
      setSingleModel: (model) => set({ singleModel: model }),

      addCompareModel: (model) => {
        const { compareModels } = get()
        if (compareModels.length >= MAX_COMPARE_MODELS) return
        if (compareModels.some((m) => sameChoice(m, model.provider, model.model))) return
        set({ compareModels: [...compareModels, model] })
      },

      removeCompareModel: (provider, model) =>
        set((state) => ({
          compareModels: state.compareModels.filter((m) => !sameChoice(m, provider, model)),
        })),
    }),
    {
      name: 'omnimind-run-composer',
      // Persist UI preferences (model selections) + the conversation POINTER.
      // The pointer is navigation state, NOT canonical data — messages still load
      // from the API, so a refresh reloads the same conversation rather than
      // restoring messages from localStorage.
      partialize: (state) => ({
        activeConversationId: state.activeConversationId,
        singleModel: state.singleModel,
        compareModels: state.compareModels,
      }),
    },
  ),
)

export { MAX_COMPARE_MODELS }
