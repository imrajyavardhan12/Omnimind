'use client'

import { useState } from 'react'
import { Eye, EyeOff, Key, Trash2 } from 'lucide-react'
import { ProviderName } from '@/lib/types'
import { useSettingsStore } from '@/lib/stores/settings'
import { cn } from '@/lib/utils'

interface ApiKeyManagerProps {
  provider: ProviderName
  className?: string
}

export function ApiKeyManager({ provider, className }: ApiKeyManagerProps) {
  const [showKey, setShowKey] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const { providers, setApiKey, getApiKey, removeApiKey } = useSettingsStore()
  
  const providerConfig = providers[provider]
  const hasApiKey = !!providerConfig.apiKey

  const handleSave = () => {
    if (inputValue.trim()) {
      setApiKey(provider, inputValue.trim())
      setInputValue('')
      setShowKey(false)
    }
  }

  const handleRemove = () => {
    removeApiKey(provider)
    setInputValue('')
    setShowKey(false)
  }

  const displayValue = hasApiKey ? 
    (showKey ? getApiKey(provider) || '' : '••••••••••••••••') : 
    inputValue

  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-foreground flex items-center gap-2">
        <Key className="w-4 h-4" />
        {providerConfig.name} API Key
      </label>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={displayValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={hasApiKey ? 'API key configured' : 'Enter your API key'}
            disabled={hasApiKey && !showKey}
            className="w-full px-3 py-2 pr-10 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        
        {hasApiKey ? (
          <button
            onClick={handleRemove}
            className="px-3 py-2 border border-destructive text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={!inputValue.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-2 text-xs">
        <div className={cn(
          'w-2 h-2 rounded-full',
          hasApiKey ? 'bg-green-500' : 'bg-gray-400'
        )} />
        <span className="text-muted-foreground">
          {hasApiKey ? 'Connected' : 'Not configured'}
        </span>
      </div>
    </div>
  )
}