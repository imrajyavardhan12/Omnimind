import { create } from 'zustand'
import { Model } from '../types'

export type CouncilStage = 'idle' | 'stage1' | 'stage2' | 'stage3' | 'complete'

export interface CouncilResponse {
  modelId: string
  modelName: string
  provider: string
  response: string
  isLoading: boolean
  error?: string
}

export interface PeerRanking {
  reviewerModelId: string
  reviewerModelName: string
  rankings: { modelId: string; rank: number; label: string }[]
  evaluation: string
  isLoading: boolean
  error?: string
}

export interface AggregateRanking {
  modelId: string
  modelName: string
  label: string
  averageRank: number
  totalPoints: number
}

export interface CouncilSession {
  id: string
  query: string
  councilModels: Model[]
  chairmanModel: Model | null
  stage: CouncilStage
  stage1Responses: CouncilResponse[]
  stage2Rankings: PeerRanking[]
  aggregateRankings: AggregateRanking[]
  stage3Synthesis: string
  stage3Loading: boolean
  createdAt: number
  completedAt?: number
}

interface CouncilState {
  // Council configuration
  councilModels: Model[]
  chairmanModel: Model | null
  
  // Current session
  currentSession: CouncilSession | null
  sessions: CouncilSession[]
  
  // Abort controllers for stopping
  abortControllers: Map<string, AbortController>
  
  // Actions
  setCouncilModels: (models: Model[]) => void
  addCouncilModel: (model: Model) => void
  removeCouncilModel: (modelId: string) => void
  setChairmanModel: (model: Model | null) => void
  
  // Session actions
  startSession: (query: string) => string
  updateStage: (stage: CouncilStage) => void
  
  // Stage 1 actions
  addStage1Response: (response: CouncilResponse) => void
  updateStage1Response: (modelId: string, updates: Partial<CouncilResponse>) => void
  
  // Stage 2 actions
  addStage2Ranking: (ranking: PeerRanking) => void
  updateStage2Ranking: (reviewerModelId: string, updates: Partial<PeerRanking>) => void
  setAggregateRankings: (rankings: AggregateRanking[]) => void
  
  // Stage 3 actions
  setStage3Synthesis: (synthesis: string) => void
  setStage3Loading: (loading: boolean) => void
  
  // Utility actions
  resetSession: () => void
  setAbortController: (key: string, controller: AbortController | null) => void
  stopAllResponses: () => void
  getCurrentSession: () => CouncilSession | null
}

export const useCouncilStore = create<CouncilState>()((set, get) => ({
  councilModels: [],
  chairmanModel: null,
  currentSession: null,
  sessions: [],
  abortControllers: new Map(),

  setCouncilModels: (models: Model[]) => {
    set({ councilModels: models })
  },

  addCouncilModel: (model: Model) => {
    const current = get().councilModels
    if (!current.find(m => m.id === model.id)) {
      set({ councilModels: [...current, model] })
    }
  },

  removeCouncilModel: (modelId: string) => {
    set(state => ({
      councilModels: state.councilModels.filter(m => m.id !== modelId)
    }))
  },

  setChairmanModel: (model: Model | null) => {
    set({ chairmanModel: model })
  },

  startSession: (query: string) => {
    const sessionId = crypto.randomUUID()
    const { councilModels, chairmanModel } = get()
    
    const newSession: CouncilSession = {
      id: sessionId,
      query,
      councilModels: [...councilModels],
      chairmanModel,
      stage: 'stage1',
      stage1Responses: councilModels.map(model => ({
        modelId: model.id,
        modelName: model.name,
        provider: model.provider,
        response: '',
        isLoading: true
      })),
      stage2Rankings: [],
      aggregateRankings: [],
      stage3Synthesis: '',
      stage3Loading: false,
      createdAt: Date.now()
    }
    
    set(state => ({
      currentSession: newSession,
      sessions: [...state.sessions, newSession]
    }))
    
    return sessionId
  },

  updateStage: (stage: CouncilStage) => {
    set(state => ({
      currentSession: state.currentSession 
        ? { ...state.currentSession, stage }
        : null
    }))
  },

  addStage1Response: (response: CouncilResponse) => {
    set(state => {
      if (!state.currentSession) return state
      
      const existing = state.currentSession.stage1Responses.findIndex(
        r => r.modelId === response.modelId
      )
      
      let newResponses = [...state.currentSession.stage1Responses]
      if (existing >= 0) {
        newResponses[existing] = response
      } else {
        newResponses.push(response)
      }
      
      return {
        currentSession: {
          ...state.currentSession,
          stage1Responses: newResponses
        }
      }
    })
  },

  updateStage1Response: (modelId: string, updates: Partial<CouncilResponse>) => {
    set(state => {
      if (!state.currentSession) return state
      
      return {
        currentSession: {
          ...state.currentSession,
          stage1Responses: state.currentSession.stage1Responses.map(r =>
            r.modelId === modelId ? { ...r, ...updates } : r
          )
        }
      }
    })
  },

  addStage2Ranking: (ranking: PeerRanking) => {
    set(state => {
      if (!state.currentSession) return state
      
      return {
        currentSession: {
          ...state.currentSession,
          stage2Rankings: [...state.currentSession.stage2Rankings, ranking]
        }
      }
    })
  },

  updateStage2Ranking: (reviewerModelId: string, updates: Partial<PeerRanking>) => {
    set(state => {
      if (!state.currentSession) return state
      
      return {
        currentSession: {
          ...state.currentSession,
          stage2Rankings: state.currentSession.stage2Rankings.map(r =>
            r.reviewerModelId === reviewerModelId ? { ...r, ...updates } : r
          )
        }
      }
    })
  },

  setAggregateRankings: (rankings: AggregateRanking[]) => {
    set(state => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, aggregateRankings: rankings }
        : null
    }))
  },

  setStage3Synthesis: (synthesis: string) => {
    set(state => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, stage3Synthesis: synthesis }
        : null
    }))
  },

  setStage3Loading: (loading: boolean) => {
    set(state => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, stage3Loading: loading }
        : null
    }))
  },

  resetSession: () => {
    // Stop all ongoing requests
    get().stopAllResponses()
    
    set({
      currentSession: null
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

  stopAllResponses: () => {
    const { abortControllers } = get()
    abortControllers.forEach((controller) => {
      try {
        controller.abort()
      } catch (error) {
        console.error('Error aborting controller:', error)
      }
    })
    set({ abortControllers: new Map() })
  },

  getCurrentSession: () => get().currentSession
}))
