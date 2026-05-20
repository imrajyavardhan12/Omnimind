import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PromptEnhancementResponse, EnhancedPrompt } from '@/lib/promptEnhancer/types'

export interface EnhancementHistory {
  id: string
  originalPrompt: string
  selectedEnhancement: EnhancedPrompt | null
  timestamp: number
  sessionId?: string
}

export interface EnhancementPreferences {
  autoEnhance: boolean
  preferredTypes: string[]
  showAnalysis: boolean
  autoExpand: boolean
  qualityThreshold: number // Auto-expand if quality below this threshold
}

interface EnhancementState {
  // Current enhancement session
  currentEnhancement: PromptEnhancementResponse | null
  isEnhancing: boolean
  
  // History and preferences
  history: EnhancementHistory[]
  preferences: EnhancementPreferences
  
  // UI State
  isExpanded: boolean
  selectedEnhancementId: string | null
  
  // Actions
  setCurrentEnhancement: (enhancement: PromptEnhancementResponse | null) => void
  setIsEnhancing: (isEnhancing: boolean) => void
  setIsExpanded: (isExpanded: boolean) => void
  setSelectedEnhancementId: (id: string | null) => void
  
  // History actions
  addToHistory: (originalPrompt: string, selectedEnhancement: EnhancedPrompt | null, sessionId?: string) => void
  clearHistory: () => void
  getHistoryForPrompt: (prompt: string) => EnhancementHistory[]
  
  // Preferences actions
  updatePreferences: (preferences: Partial<EnhancementPreferences>) => void
  
  // Utility actions
  shouldAutoExpand: (qualityScore: number) => boolean
  getRecentEnhancements: (limit?: number) => EnhancementHistory[]
}

const defaultPreferences: EnhancementPreferences = {
  autoEnhance: true,
  preferredTypes: ['detailed', 'focused', 'provider-optimized'],
  showAnalysis: true,
  autoExpand: false,
  qualityThreshold: 60
}

export const useEnhancementStore = create<EnhancementState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentEnhancement: null,
      isEnhancing: false,
      history: [],
      preferences: defaultPreferences,
      isExpanded: false,
      selectedEnhancementId: null,

      // Basic state actions
      setCurrentEnhancement: (enhancement) => {
        set({ currentEnhancement: enhancement })
        
        // Auto-expand based on quality score and preferences
        if (enhancement && get().preferences.autoExpand) {
          const shouldExpand = get().shouldAutoExpand(enhancement.analysis.qualityScore)
          set({ isExpanded: shouldExpand })
        }
      },

      setIsEnhancing: (isEnhancing) => set({ isEnhancing }),
      
      setIsExpanded: (isExpanded) => set({ isExpanded }),
      
      setSelectedEnhancementId: (id) => set({ selectedEnhancementId: id }),

      // History actions
      addToHistory: (originalPrompt, selectedEnhancement, sessionId) => {
        const history = get().history
        const newEntry: EnhancementHistory = {
          id: `history-${Date.now()}`,
          originalPrompt,
          selectedEnhancement,
          timestamp: Date.now(),
          sessionId
        }
        
        // Add to beginning of history, limit to 100 entries
        const updatedHistory = [newEntry, ...history].slice(0, 100)
        set({ history: updatedHistory })
      },

      clearHistory: () => set({ history: [] }),

      getHistoryForPrompt: (prompt) => {
        return get().history.filter(entry => 
          entry.originalPrompt.toLowerCase().includes(prompt.toLowerCase()) ||
          prompt.toLowerCase().includes(entry.originalPrompt.toLowerCase())
        )
      },

      // Preferences actions
      updatePreferences: (newPreferences) => {
        set(state => ({
          preferences: { ...state.preferences, ...newPreferences }
        }))
      },

      // Utility functions
      shouldAutoExpand: (qualityScore) => {
        const { preferences } = get()
        return preferences.autoExpand || qualityScore < preferences.qualityThreshold
      },

      getRecentEnhancements: (limit = 10) => {
        return get().history
          .filter(entry => entry.selectedEnhancement !== null)
          .slice(0, limit)
      }
    }),
    {
      name: 'omnimind-enhancement',
      version: 1,
      // Only persist preferences and history, not current session state
      partialize: (state) => ({
        history: state.history,
        preferences: state.preferences
      }),
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migration from version 0 - ensure all required fields exist
          return {
            ...persistedState,
            preferences: {
              ...defaultPreferences,
              ...persistedState.preferences
            },
            history: persistedState.history || []
          }
        }
        return persistedState
      }
    }
  )
)

// Utility hooks for common operations
export const useEnhancementHistory = () => {
  const { history, addToHistory, clearHistory, getHistoryForPrompt } = useEnhancementStore()
  return { history, addToHistory, clearHistory, getHistoryForPrompt }
}

export const useEnhancementPreferences = () => {
  const { preferences, updatePreferences } = useEnhancementStore()
  return { preferences, updatePreferences }
}