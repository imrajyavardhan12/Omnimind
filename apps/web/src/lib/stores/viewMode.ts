import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Model } from '../types'

export type ViewMode = 'single' | 'compare' | 'council'

interface ViewModeState {
  viewMode: ViewMode
  selectedSingleModel: Model | null
  isHeaderVisible: boolean
  
  // Actions
  setViewMode: (mode: ViewMode) => void
  setSelectedSingleModel: (model: Model) => void
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
        
        // When switching from compare/council to single, hide header first then change mode
        if ((currentMode === 'compare' || currentMode === 'council') && mode === 'single') {
          set({ isHeaderVisible: false })
          // Delay mode change to allow header animation to complete
          setTimeout(() => {
            set({ viewMode: mode })
          }, 250)
        } 
        // When switching from single to compare or council, change mode immediately
        else if (currentMode === 'single' && (mode === 'compare' || mode === 'council')) {
          set({ viewMode: mode, isHeaderVisible: true })
        }
        // When switching between compare and council
        else if ((currentMode === 'compare' && mode === 'council') || (currentMode === 'council' && mode === 'compare')) {
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
        // Track usage by provider + model id because model ids are only unique within a provider.
        get().incrementModelUsage(`${model.provider}:${model.id}`)
      },

      incrementModelUsage: (modelId: string) => {
        set(state => ({
          modelUsageCount: {
            ...state.modelUsageCount,
            [modelId]: (state.modelUsageCount[modelId] || 0) + 1
          }
        }))
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
