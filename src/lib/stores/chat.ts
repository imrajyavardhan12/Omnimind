import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatSession, Message, ProviderName } from '../types'

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  isLoading: Record<ProviderName, boolean>
  visibleProviders: Record<ProviderName, boolean>
  
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
  }
}),
    {
      name: 'omnimind-chat-sessions',
      // Only persist essential data (visibility persists across refresh but resets per session)
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        visibleProviders: state.visibleProviders
      })
    }
  )
)