import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Model } from '../types'

export type ViewMode = 'single' | 'compare'

interface ViewModeState {
  viewMode: ViewMode
  selectedSingleModel: Model | null
  isHeaderVisible: boolean
  
  // Actions
  setViewMode: (mode: ViewMode) => void
  setSelectedSingleModel: (model: Model) => void
  getMostUsedModel: () => Model | null
  setIsHeaderVisible: (visible: boolean) => void
  toggleHeaderVisibility: () => void
  
  // Usage tracking
  modelUsageCount: Record<string, number>
  incrementModelUsage: (modelId: string) => void
}

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set, get) => ({
      viewMode: 'single', // Default to single mode (ChatGPT-like)
      selectedSingleModel: null,
      modelUsageCount: {},
      isHeaderVisible: true,

      setViewMode: (mode: ViewMode) => {
        const currentMode = get().viewMode
        
        // When switching from compare to single, hide header first then change mode
        if (currentMode === 'compare' && mode === 'single') {
          set({ isHeaderVisible: false })
          // Delay mode change to allow header animation to complete
          setTimeout(() => {
            set({ viewMode: mode })
          }, 250)
        } 
        // When switching from single to compare, change mode immediately
        else if (currentMode === 'single' && mode === 'compare') {
          set({ viewMode: mode, isHeaderVisible: true })
        }
        else {
          set({ viewMode: mode })
        }
      },

      setIsHeaderVisible: (visible: boolean) => {
        set({ isHeaderVisible: visible })
      },

      toggleHeaderVisibility: () => {
        set(state => ({ isHeaderVisible: !state.isHeaderVisible }))
      },

      setSelectedSingleModel: (model: Model) => {
        set({ selectedSingleModel: model })
        // Track usage when model is selected
        get().incrementModelUsage(model.id)
      },

      incrementModelUsage: (modelId: string) => {
        set(state => ({
          modelUsageCount: {
            ...state.modelUsageCount,
            [modelId]: (state.modelUsageCount[modelId] || 0) + 1
          }
        }))
      },

      getMostUsedModel: () => {
        const { modelUsageCount } = get()
        
        // Get all available models (we'll import this from model tabs store)
        const allModels = getAvailableModels()
        
        if (allModels.length === 0) return null
        
        // Find the most used model
        let mostUsedModel = allModels[0]
        let maxUsage = modelUsageCount[mostUsedModel.id] || 0
        
        allModels.forEach(model => {
          const usage = modelUsageCount[model.id] || 0
          if (usage > maxUsage) {
            maxUsage = usage
            mostUsedModel = model
          }
        })
        
        return mostUsedModel
      }
    }),
    {
      name: 'omnimind-view-mode',
      partialize: (state) => ({
        viewMode: state.viewMode,
        selectedSingleModel: state.selectedSingleModel,
        modelUsageCount: state.modelUsageCount,
        isHeaderVisible: state.isHeaderVisible
      })
    }
  )
)

// Helper function to get available models
function getAvailableModels(): Model[] {
  try {
    // Dynamic import to avoid circular dependency
    if (typeof window !== 'undefined') {
      const { useModelTabsStore } = require('./modelTabs')
      return useModelTabsStore.getState().getAllAvailableModels()
    }
    return []
  } catch (error) {
    console.warn('Failed to get available models:', error)
    return []
  }
}
