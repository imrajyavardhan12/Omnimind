import { useCallback } from 'react'
import { useCouncilStore, AggregateRanking } from '@/lib/stores/council'
import { useSettingsStore } from '@/lib/stores/settings'
import { Model, ProviderName } from '@/lib/types'
import { logger } from '@/lib/utils/logger'

export function useCouncil() {
  const {
    councilModels,
    chairmanModel,
    currentSession,
    startSession,
    updateStage,
    updateStage1Response,
    addStage2Ranking,
    updateStage2Ranking,
    setAggregateRankings,
    setStage3Synthesis,
    setStage3Loading,
    setAbortController,
    stopAllResponses
  } = useCouncilStore()
  
  const { getApiKey, providers, temperature, maxTokens } = useSettingsStore()

  // Helper to send a message to a model
  const queryModel = useCallback(async (
    model: Model,
    messages: { role: string; content: string }[],
    signal?: AbortSignal
  ): Promise<string> => {
    const provider = model.provider as ProviderName
    const apiKey = getApiKey(provider)
    const providerConfig = providers[provider]
    
    if (!apiKey && !providerConfig?.isFree) {
      throw new Error(`No API key for ${provider}`)
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { [`x-api-key-${provider}`]: apiKey } : {})
      },
      body: JSON.stringify({
        messages: messages.map((m, i) => ({
          id: `msg-${i}`,
          role: m.role,
          content: m.content,
          timestamp: Date.now()
        })),
        provider,
        model: model.id,
        temperature,
        maxTokens,
        stream: false
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get response')
    }

    const data = await response.json()
    return data.content
  }, [getApiKey, providers, temperature, maxTokens])

  // Stage 1: Get individual responses from all models
  const runStage1 = useCallback(async (query: string) => {
    logger.debug('Starting Stage 1: Individual Opinions')
    
    const promises = councilModels.map(async (model) => {
      const abortController = new AbortController()
      setAbortController(`stage1-${model.id}`, abortController)
      
      try {
        const response = await queryModel(
          model,
          [{ role: 'user', content: query }],
          abortController.signal
        )
        
        updateStage1Response(model.id, {
          response,
          isLoading: false
        })
        
        return { modelId: model.id, response, success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        updateStage1Response(model.id, {
          error: errorMessage,
          isLoading: false
        })
        return { modelId: model.id, error: errorMessage, success: false }
      } finally {
        setAbortController(`stage1-${model.id}`, null)
      }
    })

    const results = await Promise.all(promises)
    logger.debug('Stage 1 complete:', results)
    
    return results.filter(r => r.success)
  }, [councilModels, queryModel, updateStage1Response, setAbortController])

  // Stage 2: Peer review - each model ranks all responses
  const runStage2 = useCallback(async (query: string, stage1Responses: { modelId: string; response: string }[]) => {
    logger.debug('Starting Stage 2: Peer Review')
    updateStage('stage2')
    
    // Create anonymous labels
    const labels = stage1Responses.map((_, i) => String.fromCharCode(65 + i)) // A, B, C, ...
    
    // Build the anonymized responses text
    const anonymizedResponses = stage1Responses
      .map((r, i) => `**Response ${labels[i]}:**\n${r.response}`)
      .join('\n\n---\n\n')

    const rankingPrompt = `You are evaluating responses to this question: "${query}"

Here are the anonymized responses from different AI models:

${anonymizedResponses}

---

Please evaluate each response for accuracy, completeness, clarity, and insight.
Then rank all responses from best to worst.

IMPORTANT: You must end your evaluation with a clear ranking in this exact format:
FINAL RANKING:
1. Response [letter]
2. Response [letter]
... and so on for all responses

Provide your evaluation:`

    const promises = councilModels.map(async (model) => {
      const abortController = new AbortController()
      setAbortController(`stage2-${model.id}`, abortController)
      
      // Initialize ranking entry
      addStage2Ranking({
        reviewerModelId: model.id,
        reviewerModelName: model.name,
        rankings: [],
        evaluation: '',
        isLoading: true
      })
      
      try {
        const evaluation = await queryModel(
          model,
          [{ role: 'user', content: rankingPrompt }],
          abortController.signal
        )
        
        // Parse rankings from response
        const rankings = parseRankings(evaluation, labels, stage1Responses)
        
        updateStage2Ranking(model.id, {
          rankings,
          evaluation,
          isLoading: false
        })
        
        return { reviewerModelId: model.id, rankings, success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        updateStage2Ranking(model.id, {
          error: errorMessage,
          isLoading: false
        })
        return { reviewerModelId: model.id, error: errorMessage, success: false }
      } finally {
        setAbortController(`stage2-${model.id}`, null)
      }
    })

    const results = await Promise.all(promises)
    
    // Calculate aggregate rankings
    const aggregates = calculateAggregateRankings(
      results.filter(r => r.success) as { reviewerModelId: string; rankings: { modelId: string; rank: number; label: string }[] }[],
      stage1Responses,
      labels
    )
    setAggregateRankings(aggregates)
    
    logger.debug('Stage 2 complete:', results)
    return aggregates
  }, [councilModels, queryModel, updateStage, addStage2Ranking, updateStage2Ranking, setAggregateRankings, setAbortController])

  // Stage 3: Chairman synthesizes final answer
  const runStage3 = useCallback(async (
    query: string,
    stage1Responses: { modelId: string; modelName: string; response: string }[],
    aggregateRankings: AggregateRanking[]
  ) => {
    if (!chairmanModel) {
      throw new Error('No chairman model selected')
    }
    
    logger.debug('Starting Stage 3: Final Synthesis')
    updateStage('stage3')
    setStage3Loading(true)
    
    const abortController = new AbortController()
    setAbortController('stage3', abortController)
    
    // Build context for chairman
    const rankedResponses = aggregateRankings
      .sort((a, b) => a.averageRank - b.averageRank)
      .map((ranking, index) => {
        const response = stage1Responses.find(r => r.modelId === ranking.modelId)
        return `**#${index + 1} - ${ranking.modelName}** (Average rank: ${ranking.averageRank.toFixed(2)}):\n${response?.response || 'N/A'}`
      })
      .join('\n\n---\n\n')

    const synthesisPrompt = `You are the Chairman of an AI Council. Your task is to synthesize the collective wisdom of the council into a final, comprehensive answer.

**Original Question:** ${query}

**Council Responses (ranked by peer review):**

${rankedResponses}

---

As Chairman, synthesize these perspectives into a single, well-structured answer that:
1. Incorporates the best insights from each council member
2. Resolves any contradictions between responses
3. Provides a clear, comprehensive answer to the original question
4. Acknowledges areas of uncertainty if the council was divided

Provide your synthesized answer:`

    try {
      const synthesis = await queryModel(
        chairmanModel,
        [{ role: 'user', content: synthesisPrompt }],
        abortController.signal
      )
      
      setStage3Synthesis(synthesis)
      setStage3Loading(false)
      updateStage('complete')
      
      logger.debug('Stage 3 complete')
      return synthesis
    } catch (error) {
      setStage3Loading(false)
      throw error
    } finally {
      setAbortController('stage3', null)
    }
  }, [chairmanModel, queryModel, updateStage, setStage3Synthesis, setStage3Loading, setAbortController])

  // Run full council
  const runCouncil = useCallback(async (query: string) => {
    if (councilModels.length < 2) {
      throw new Error('Need at least 2 council members')
    }
    if (!chairmanModel) {
      throw new Error('No chairman selected')
    }
    
    // Start new session
    startSession(query)
    
    try {
      // Stage 1
      const stage1Results = await runStage1(query)
      const successfulResponses = stage1Results.filter(r => r.success && 'response' in r) as { modelId: string; response: string }[]
      
      if (successfulResponses.length < 2) {
        throw new Error('Need at least 2 successful responses for peer review')
      }
      
      // Stage 2
      const aggregates = await runStage2(query, successfulResponses)
      
      // Stage 3
      const stage1WithNames = successfulResponses.map(r => {
        const model = councilModels.find(m => m.id === r.modelId)
        return {
          ...r,
          modelName: model?.name || r.modelId
        }
      })
      
      await runStage3(query, stage1WithNames, aggregates)
      
    } catch (error) {
      logger.error('Council error:', error)
      throw error
    }
  }, [councilModels, chairmanModel, startSession, runStage1, runStage2, runStage3])

  return {
    councilModels,
    chairmanModel,
    currentSession,
    runCouncil,
    stopAllResponses,
    isReady: councilModels.length >= 2 && chairmanModel !== null
  }
}

// Helper function to parse rankings from evaluation text
function parseRankings(
  evaluation: string,
  labels: string[],
  responses: { modelId: string }[]
): { modelId: string; rank: number; label: string }[] {
  const rankings: { modelId: string; rank: number; label: string }[] = []
  
  // Look for "FINAL RANKING:" section
  const rankingSection = evaluation.split(/FINAL RANKING:/i)[1] || evaluation
  
  // Try to find patterns like "1. Response A" or "1. A" or "#1 Response A"
  const rankPattern = /(?:^|\n)\s*(?:#)?(\d+)\.?\s*(?:Response\s*)?([A-Z])/gi
  let match
  
  while ((match = rankPattern.exec(rankingSection)) !== null) {
    const rank = parseInt(match[1])
    const label = match[2].toUpperCase()
    const labelIndex = labels.indexOf(label)
    
    if (labelIndex >= 0 && labelIndex < responses.length) {
      rankings.push({
        modelId: responses[labelIndex].modelId,
        rank,
        label
      })
    }
  }
  
  // If parsing failed, assign default rankings
  if (rankings.length === 0) {
    responses.forEach((r, i) => {
      rankings.push({
        modelId: r.modelId,
        rank: i + 1,
        label: labels[i]
      })
    })
  }
  
  return rankings.sort((a, b) => a.rank - b.rank)
}

// Helper function to calculate aggregate rankings
function calculateAggregateRankings(
  allRankings: { reviewerModelId: string; rankings: { modelId: string; rank: number; label: string }[] }[],
  responses: { modelId: string }[],
  labels: string[]
): AggregateRanking[] {
  const aggregates: Record<string, { totalRank: number; count: number; label: string }> = {}
  
  // Initialize
  responses.forEach((r, i) => {
    aggregates[r.modelId] = { totalRank: 0, count: 0, label: labels[i] }
  })
  
  // Sum up ranks
  allRankings.forEach(review => {
    review.rankings.forEach(ranking => {
      if (aggregates[ranking.modelId]) {
        aggregates[ranking.modelId].totalRank += ranking.rank
        aggregates[ranking.modelId].count++
      }
    })
  })
  
  // Calculate averages
  const { councilModels } = useCouncilStore.getState()
  
  return Object.entries(aggregates).map(([modelId, data]) => {
    const model = councilModels.find(m => m.id === modelId)
    return {
      modelId,
      modelName: model?.name || modelId,
      label: data.label,
      averageRank: data.count > 0 ? data.totalRank / data.count : 999,
      totalPoints: data.totalRank
    }
  })
}
