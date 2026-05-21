import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Model, ProviderName } from '../types'

export interface ModelSettings {
  temperature: number
  maxTokens: number
  systemPrompt: string
}

export interface SelectedModel {
  id: string
  model: Model
  provider: ProviderName
  settings: ModelSettings
}

interface ModelTabsState {
  selectedModels: SelectedModel[]
  maxModels: number
  defaultSettings: ModelSettings
  
  // Actions
  addModel: (model: Model) => void
  removeModel: (selectedModelId: string) => void
  clearAllModels: () => void
  isModelSelected: (modelId: string, provider?: string) => boolean
  canAddMore: () => boolean
  updateModelSettings: (selectedModelId: string, settings: Partial<ModelSettings>) => void
  getModelSettings: (selectedModelId: string) => ModelSettings | null
}

export const useModelTabsStore = create<ModelTabsState>()(
  persist(
    (set, get) => ({
      defaultSettings: {
        temperature: 0.7,
        maxTokens: 2048, // Aligned with global settings default
        systemPrompt: ''
      },
      
      selectedModels: [
        // Start with no models selected - users choose what they want to compare
      ],
      maxModels: 5,

      addModel: (model: Model) => {
        const { selectedModels, maxModels } = get()
        
        if (selectedModels.length >= maxModels) {
          console.warn(`Cannot add more than ${maxModels} models`)
          return
        }

        if (get().isModelSelected(model.id, model.provider)) {
          console.warn(`Model ${model.provider}/${model.id} is already selected`)
          return
        }

        const newSelectedModel: SelectedModel = {
          id: `tab-${model.provider}-${model.id}-${Date.now()}`,
          model,
          provider: model.provider as ProviderName,
          settings: { ...get().defaultSettings }
        }

        set(state => ({
          selectedModels: [...state.selectedModels, newSelectedModel]
        }))
      },

      removeModel: (selectedModelId: string) => {
        set(state => ({
          selectedModels: state.selectedModels.filter(sm => sm.id !== selectedModelId)
        }))
      },

      clearAllModels: () => {
        set({ selectedModels: [] })
      },

      isModelSelected: (modelId: string, provider?: string) => {
        const { selectedModels } = get()
        return selectedModels.some(sm => sm.model.id === modelId && (!provider || sm.provider === provider))
      },

      canAddMore: () => {
        const { selectedModels, maxModels } = get()
        return selectedModels.length < maxModels
      },

      updateModelSettings: (selectedModelId: string, settings: Partial<ModelSettings>) => {
        set(state => ({
          selectedModels: state.selectedModels.map(sm =>
            sm.id === selectedModelId
              ? { ...sm, settings: { ...sm.settings, ...settings } }
              : sm
          )
        }))
      },

      getModelSettings: (selectedModelId: string) => {
        const { selectedModels } = get()
        const selectedModel = selectedModels.find(sm => sm.id === selectedModelId)
        return selectedModel?.settings || null
      }
    }),
    {
      name: 'omnimind-model-tabs',
      // Reset on new sessions by checking activeSessionId
      partialize: (state) => ({
        selectedModels: state.selectedModels,
        maxModels: state.maxModels,
        defaultSettings: state.defaultSettings
      })
    }
  )
)