import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatSession, Message, ProviderName, ConversationBranch } from '../types'

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
  
  // Branching actions
  createBranch: (sessionId: string, fromMessageId: string, branchName?: string) => string
  switchBranch: (sessionId: string, branchId: string) => void
  deleteBranch: (sessionId: string, branchId: string) => void
  renameBranch: (sessionId: string, branchId: string, newName: string) => void
  getBranchMessages: (sessionId: string, branchId?: string) => Message[]
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
      branches: [],
      activeBranchId: undefined,
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
        
        let updatedMessages = [...session.messages]
        
        // If we're in a branch, handle branch messages
        if (session.activeBranchId) {
          const branch = session.branches?.find(b => b.id === session.activeBranchId)
          if (branch) {
            // Add branch info to message
            message.branchId = session.activeBranchId
            
            // Update branch messages
            const updatedBranches = session.branches?.map(b => 
              b.id === session.activeBranchId 
                ? { ...b, messages: [...b.messages, message] }
                : b
            )
            
            return {
              ...session,
              branches: updatedBranches,
              messages: updatedMessages,
              title: session.messages.length === 0 && message.role === 'user' ? 
                message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '') : 
                session.title,
              updatedAt: Date.now()
            }
          }
        }
        
        // Normal message addition to main thread
        updatedMessages.push(message)
        
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
        
        // Check if message is in a branch
        if (session.activeBranchId) {
          const updatedBranches = session.branches?.map(branch => {
            if (branch.id === session.activeBranchId) {
              return {
                ...branch,
                messages: branch.messages.map(msg => 
                  msg.id === messageId ? { ...msg, ...updates } : msg
                )
              }
            }
            return branch
          })
          
          return {
            ...session,
            branches: updatedBranches,
            updatedAt: Date.now()
          }
        }
        
        // Update in main messages
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
        console.log(`Aborting controller for ${key}`)
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
    console.log('Stopping all responses, active controllers:', state.abortControllers.size)
    
    state.abortControllers.forEach((controller, key) => {
      console.log(`Aborting controller for ${key}`)
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

  // Branching functions
  createBranch: (sessionId: string, fromMessageId: string, branchName?: string) => {
    const branchId = crypto.randomUUID()
    const session = get().sessions.find(s => s.id === sessionId)
    if (!session) return branchId

    // Find the message to branch from
    const messageIndex = session.messages.findIndex(m => m.id === fromMessageId)
    if (messageIndex === -1) return branchId

    // Get all messages up to and including the branch point
    const branchMessages = session.messages.slice(0, messageIndex + 1).map(msg => ({
      ...msg,
      branchFromId: msg.id === fromMessageId ? fromMessageId : msg.branchFromId,
      branchId: branchId
    }))

    const newBranch: ConversationBranch = {
      id: branchId,
      name: branchName || `Branch ${(session.branches?.length || 0) + 1}`,
      parentMessageId: fromMessageId,
      messages: branchMessages,
      createdAt: Date.now(),
      isActive: true
    }

    set(state => ({
      sessions: state.sessions.map(s => 
        s.id === sessionId 
          ? {
              ...s,
              branches: [...(s.branches || []), newBranch],
              activeBranchId: branchId,
              updatedAt: Date.now()
            }
          : s
      )
    }))

    return branchId
  },

  switchBranch: (sessionId: string, branchId: string) => {
    set(state => ({
      sessions: state.sessions.map(session => 
        session.id === sessionId
          ? {
              ...session,
              activeBranchId: branchId === 'main' ? undefined : branchId,
              updatedAt: Date.now()
            }
          : session
      )
    }))
  },

  deleteBranch: (sessionId: string, branchId: string) => {
    set(state => ({
      sessions: state.sessions.map(session => 
        session.id === sessionId
          ? {
              ...session,
              branches: session.branches?.filter(b => b.id !== branchId),
              activeBranchId: session.activeBranchId === branchId ? undefined : session.activeBranchId,
              updatedAt: Date.now()
            }
          : session
      )
    }))
  },

  renameBranch: (sessionId: string, branchId: string, newName: string) => {
    set(state => ({
      sessions: state.sessions.map(session => 
        session.id === sessionId
          ? {
              ...session,
              branches: session.branches?.map(b => 
                b.id === branchId ? { ...b, name: newName } : b
              ),
              updatedAt: Date.now()
            }
          : session
      )
    }))
  },

  getBranchMessages: (sessionId: string, branchId?: string) => {
    const session = get().sessions.find(s => s.id === sessionId)
    if (!session) return []

    if (!branchId || branchId === 'main') {
      return session.messages
    }

    const branch = session.branches?.find(b => b.id === branchId)
    return branch?.messages || []
  }
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
          })),
          branches: session.branches?.map(branch => ({
            ...branch,
            messages: branch.messages.map(message => ({
              ...message,
              attachments: message.attachments?.map(att => ({
                ...att,
                data: '',
                url: ''
              }))
            }))
          }))
        })),
        activeSessionId: state.activeSessionId,
        visibleProviders: state.visibleProviders
      })
    }
  )
)