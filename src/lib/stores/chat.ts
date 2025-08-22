import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatSession, Message, ProviderName } from '../types'

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  isLoading: Record<ProviderName, boolean>
  visibleProviders: Record<ProviderName, boolean>
  abortControllers: Record<ProviderName, AbortController | null>
  
  // Actions
  createSession: () => string
  setActiveSession: (sessionId: string) => void
  addMessage: (sessionId: string, message: Message) => void
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void
  deleteSession: (sessionId: string) => void
  setLoading: (provider: ProviderName, loading: boolean) => void
  getActiveSession: () => ChatSession | null
  toggleProviderVisibility: (provider: ProviderName) => void
  resetProviderVisibility: () => void
  setAbortController: (provider: ProviderName, controller: AbortController | null) => void
  stopResponse: (provider?: ProviderName) => void
  stopAllResponses: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  sessions: [],
  activeSessionId: null,
  isLoading: {
    openai: false,
    anthropic: false,
    gemini: false,
    openrouter: false
  },
  visibleProviders: {
    openai: true,
    anthropic: true,
    gemini: true,
    openrouter: true
  },
  abortControllers: {
    openai: null,
    anthropic: null,
    gemini: null,
    openrouter: null
  },

  createSession: () => {
    const sessionId = crypto.randomUUID()
    const newSession: ChatSession = {
      id: sessionId,
      title: 'New Conversation',
      messages: [],
      activeProviders: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    set(state => ({
      sessions: [...state.sessions, newSession],
      activeSessionId: sessionId,
      // Reset provider visibility for new session
      visibleProviders: {
        openai: true,
        anthropic: true,
        gemini: true,
        openrouter: true
      }
    }))

    return sessionId
  },

  setActiveSession: (sessionId: string) => {
    set({ activeSessionId: sessionId })
  },

  addMessage: (sessionId: string, message: Message) => {
    set(state => ({
      sessions: state.sessions.map(session => 
        session.id === sessionId
          ? {
              ...session,
              messages: [...session.messages, message],
              title: session.messages.length === 0 && message.role === 'user' ? 
                message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '') : 
                session.title,
              updatedAt: Date.now()
            }
          : session
      )
    }))
  },

  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => {
    set(state => ({
      sessions: state.sessions.map(session =>
        session.id === sessionId
          ? {
              ...session,
              messages: session.messages.map(message =>
                message.id === messageId
                  ? { ...message, ...updates }
                  : message
              ),
              updatedAt: Date.now()
            }
          : session
      )
    }))
  },

  deleteSession: (sessionId: string) => {
    set(state => ({
      sessions: state.sessions.filter(session => session.id !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId
    }))
  },

  setLoading: (provider: ProviderName, loading: boolean) => {
    set(state => ({
      isLoading: {
        ...state.isLoading,
        [provider]: loading
      }
    }))
  },

  getActiveSession: () => {
    const state = get()
    return state.sessions.find(session => session.id === state.activeSessionId) || null
  },

  toggleProviderVisibility: (provider: ProviderName) => {
    set(state => ({
      visibleProviders: {
        ...state.visibleProviders,
        [provider]: !state.visibleProviders[provider]
      }
    }))
  },

  resetProviderVisibility: () => {
    set({
      visibleProviders: {
        openai: true,
        anthropic: true,
        gemini: true,
        openrouter: true
      }
    })
  },

  setAbortController: (provider: ProviderName, controller: AbortController | null) => {
    set(state => ({
      abortControllers: {
        ...state.abortControllers,
        [provider]: controller
      }
    }))
  },

  stopResponse: (provider?: ProviderName) => {
    const state = get()
    if (provider) {
      // Stop specific provider
      const controller = state.abortControllers[provider]
      if (controller) {
        controller.abort()
        set(state => ({
          abortControllers: {
            ...state.abortControllers,
            [provider]: null
          },
          isLoading: {
            ...state.isLoading,
            [provider]: false
          }
        }))
      }
    }
  },

  stopAllResponses: () => {
    const state = get()
    // Abort all active controllers
    Object.entries(state.abortControllers).forEach(([provider, controller]) => {
      if (controller) {
        controller.abort()
      }
    })
    
    // Reset all controllers and loading states
    set({
      abortControllers: {
        openai: null,
        anthropic: null,
        gemini: null,
        openrouter: null
      },
      isLoading: {
        openai: false,
        anthropic: false,
        gemini: false,
        openrouter: false
      }
    })
  }
}),
    {
      name: 'omnimind-chat-sessions',
      // Only persist essential data, exclude file attachments to prevent quota issues
      partialize: (state) => ({
        sessions: state.sessions.map(session => ({
          ...session,
          messages: session.messages.map(message => ({
            ...message,
            // Don't persist file data to avoid storage quota issues
            attachments: message.attachments?.map(att => ({
              ...att,
              data: '', // Remove base64 data from storage
              url: '' // Remove blob URLs from storage  
            }))
          }))
        })),
        activeSessionId: state.activeSessionId,
        visibleProviders: state.visibleProviders
      })
    }
  )
)