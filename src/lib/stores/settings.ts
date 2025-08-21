import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ProviderConfig, ProviderName } from '../types'
import { secureStore, secureRetrieve, secureRemove } from '../utils/encryption'

interface SettingsState {
  providers: Record<ProviderName, ProviderConfig>
  selectedModels: Record<ProviderName, string>
  temperature: number
  maxTokens: number
  
  // Actions
  setApiKey: (provider: ProviderName, apiKey: string) => void
  getApiKey: (provider: ProviderName) => string | null
  removeApiKey: (provider: ProviderName) => void
  setSelectedModel: (provider: ProviderName, modelId: string) => void
  setTemperature: (temperature: number) => void
  setMaxTokens: (maxTokens: number) => void
  toggleProvider: (provider: ProviderName, enabled: boolean) => void
}

const defaultProviders: Record<ProviderName, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    apiKey: '',
    models: [],
    enabled: false
  },
  anthropic: {
    name: 'Anthropic',
    apiKey: '',
    models: [],
    enabled: false
  },
  gemini: {
    name: 'Google Gemini',
    apiKey: '',
    models: [],
    enabled: false
  },
  openrouter: {
    name: 'OpenRouter',
    apiKey: '',
    models: [],
    enabled: false
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      providers: defaultProviders,
      selectedModels: {
        openai: 'gpt-4',
        anthropic: 'claude-3-5-sonnet-20241022',
        gemini: 'gemini-1.5-pro',
        openrouter: 'openai/gpt-4'
      },
      temperature: 0.7,
      maxTokens: 1000,

      setApiKey: (provider: ProviderName, apiKey: string) => {
        const key = `apikey_${provider}`
        if (apiKey) {
          secureStore(key, apiKey)
        } else {
          secureRemove(key)
        }
        
        set(state => ({
          providers: {
            ...state.providers,
            [provider]: {
              ...state.providers[provider],
              apiKey: apiKey ? '***' : '',
              enabled: !!apiKey
            }
          }
        }))
      },

      getApiKey: (provider: ProviderName) => {
        const key = `apikey_${provider}`
        return secureRetrieve(key)
      },

      removeApiKey: (provider: ProviderName) => {
        const key = `apikey_${provider}`
        secureRemove(key)
        
        set(state => ({
          providers: {
            ...state.providers,
            [provider]: {
              ...state.providers[provider],
              apiKey: '',
              enabled: false
            }
          }
        }))
      },

      setSelectedModel: (provider: ProviderName, modelId: string) => {
        set(state => ({
          selectedModels: {
            ...state.selectedModels,
            [provider]: modelId
          }
        }))
      },

      setTemperature: (temperature: number) => {
        set({ temperature })
      },

      setMaxTokens: (maxTokens: number) => {
        set({ maxTokens })
      },

      toggleProvider: (provider: ProviderName, enabled: boolean) => {
        set(state => ({
          providers: {
            ...state.providers,
            [provider]: {
              ...state.providers[provider],
              enabled
            }
          }
        }))
      }
    }),
    {
      name: 'omnimind-settings',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migrate from old version - ensure all providers exist
          return {
            ...persistedState,
            providers: {
              ...defaultProviders,
              ...persistedState.providers
            },
            selectedModels: {
              openai: 'gpt-4',
              anthropic: 'claude-3-5-sonnet-20241022',
              gemini: 'gemini-1.5-pro',
              openrouter: 'openai/gpt-4',
              ...persistedState.selectedModels
            }
          }
        }
        return persistedState
      },
      // Don't persist API keys in localStorage - they're handled separately
      partialize: (state) => ({
        selectedModels: state.selectedModels,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        providers: Object.fromEntries(
          Object.entries(state.providers).map(([key, provider]) => [
            key,
            { ...provider, apiKey: '' }
          ])
        )
      })
    }
  )
)