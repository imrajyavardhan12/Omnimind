import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatSession, Message, ProviderName } from '../types'
import { logger } from '../utils/logger'

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  isLoading: Record<string, boolean>
  visibleProviders: Record<ProviderName, boolean>
  abortControllers: Map<string, AbortController>
  
  // Actions
  createSession: () => string
  setActiveSession: (sessionId: string) => void
  addMessage: (sessionId: string, message: Message) => void
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void
  deleteSession: (sessionId: string) => void
  setLoading: (key: string, loading: boolean) => void
  getActiveSession: () => ChatSession | null
  toggleProviderVisibility: (provider: ProviderName) => void
  resetProviderVisibility: () => void
  setAbortController: (key: string, controller: AbortController | null) => void
  stopResponse: (key?: string) => void
  stopAllResponses: () => void
  
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  sessions: [],
  activeSessionId: null,
  isLoading: {},
  visibleProviders: {
    openai: true,
    anthropic: true,
    gemini: true,
    openrouter: true
  },
  abortControllers: new Map(),

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
      sessions: state.sessions.map(session => {
        if (session.id !== sessionId) return session
        
        const updatedMessages = [...session.messages, message]
        
        return {
          ...session,
          messages: updatedMessages,
          title: session.messages.length === 0 && message.role === 'user' ? 
            message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '') : 
            session.title,
          updatedAt: Date.now()
        }
      })
    }))
  },

  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => {
    set(state => ({
      sessions: state.sessions.map(session => {
        if (session.id !== sessionId) return session
        
        return {
          ...session,
          messages: session.messages.map(message =>
            message.id === messageId
              ? { ...message, ...updates }
              : message
          ),
          updatedAt: Date.now()
        }
      })
    }))
  },

  deleteSession: (sessionId: string) => {
    set(state => ({
      sessions: state.sessions.filter(session => session.id !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId
    }))
  },

  setLoading: (key: string, loading: boolean) => {
    set(state => ({
      isLoading: {
        ...state.isLoading,
        [key]: loading
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

  setAbortController: (key: string, controller: AbortController | null) => {
    set(state => {
      const newControllers = new Map(state.abortControllers)
      if (controller) {
        newControllers.set(key, controller)
      } else {
        newControllers.delete(key)
      }
      return { abortControllers: newControllers }
    })
  },

  stopResponse: (key?: string) => {
    const state = get()
    if (key) {
      const controller = state.abortControllers.get(key)
      if (controller) {
        logger.debug(`Aborting controller for ${key}`)
        controller.abort()
        set(state => {
          const newControllers = new Map(state.abortControllers)
          newControllers.delete(key)
          return {
            abortControllers: newControllers,
            isLoading: {
              ...state.isLoading,
              [key]: false
            }
          }
        })
      }
    }
  },

  stopAllResponses: () => {
    const state = get()
    logger.debug('Stopping all responses, active controllers:', state.abortControllers.size)
    
    state.abortControllers.forEach((controller, key) => {
      logger.debug(`Aborting controller for ${key}`)
      try {
        controller.abort()
      } catch (error) {
        console.error(`Error aborting controller for ${key}:`, error)
      }
    })
    
    const clearedLoading: Record<string, boolean> = {}
    Object.keys(state.isLoading).forEach(key => {
      clearedLoading[key] = false
    })
    
    set({
      abortControllers: new Map(),
      isLoading: clearedLoading
    })
  },

}),
    {
      name: 'omnimind-chat-sessions',
      partialize: (state) => ({
        sessions: state.sessions.map(session => ({
          ...session,
          messages: session.messages.map(message => ({
            ...message,
            attachments: message.attachments?.map(att => ({
              ...att,
              data: '',
              url: ''  
            }))
          }))
        })),
        activeSessionId: state.activeSessionId,
        visibleProviders: state.visibleProviders
      })
    }
  )
)