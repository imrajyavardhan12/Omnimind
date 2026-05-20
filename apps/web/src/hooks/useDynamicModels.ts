import { useState, useEffect } from 'react'
import { Model, ProviderName } from '@/lib/types'
import { useSettingsStore } from '@/lib/stores/settings'

export function useDynamicModels(provider: ProviderName) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { getApiKey } = useSettingsStore()
  
  useEffect(() => {
    const fetchModels = async () => {
      const apiKey = getApiKey(provider)
      if (!apiKey) {
        setModels([])
        return
      }
      
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/models?provider=${provider}`, {
          headers: {
            [`x-api-key-${provider}`]: apiKey
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch models')
        }
        
        const data = await response.json()
        setModels(data.models || [])
      } catch (err) {
        console.error(`Error fetching ${provider} models:`, err)
        setError(err instanceof Error ? err.message : 'Failed to fetch models')
        setModels([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchModels()
  }, [provider, getApiKey])
  
  return { models, loading, error }
}
