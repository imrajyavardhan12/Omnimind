'use client'

import { useState } from 'react'
import { Eye, EyeOff, Key, Trash2, Sparkles } from 'lucide-react'
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
  const isFreeProvider = providerConfig.isFree

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
        {isFreeProvider && (
          <span className="ml-auto flex items-center gap-1 text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-1 rounded-full font-semibold">
            <Sparkles className="w-3 h-3" />
            FREE
          </span>
        )}
      </label>
      
      {isFreeProvider ? (
        <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-md">
          <p className="text-sm text-green-700 dark:text-green-300 mb-1 font-medium">
            ✨ No API key required - Free for everyone!
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">
            Powered by Google AI Studio&apos;s generous free tier. Start chatting immediately without any setup.
          </p>
        </div>
      ) : (
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
      )}
      
      {!isFreeProvider && (
        <div className="flex items-center gap-2 text-xs">
          <div className={cn(
            'w-2 h-2 rounded-full',
            hasApiKey ? 'bg-green-500' : 'bg-gray-400'
          )} />
          <span className="text-muted-foreground">
            {hasApiKey ? 'Connected' : 'Not configured'}
          </span>
        </div>
      )}
    </div>
  )
}