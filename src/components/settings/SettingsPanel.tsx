'use client'

import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { ProviderName } from '@/lib/types'
import { ApiKeyManager } from './ApiKeyManager'
import { EnhancementSettings } from './EnhancementSettings'

interface SettingsPanelProps {
  className?: string
}

const providers: ProviderName[] = ['openai', 'anthropic', 'gemini', 'openrouter']

export function SettingsPanel({ className }: SettingsPanelProps) {
  const [showDevSettings, setShowDevSettings] = useState(false)

  useEffect(() => {
    // Check for dev mode via URL param or localStorage
    const urlParams = new URLSearchParams(window.location.search)
    const devMode = urlParams.get('dev') === 'true' || 
                   localStorage.getItem('omnimind-dev-mode') === 'true'
    setShowDevSettings(devMode)

    // Listen for konami code or key combination (Ctrl+Shift+D)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setShowDevSettings(prev => {
          const newValue = !prev
          localStorage.setItem('omnimind-dev-mode', String(newValue))
          return newValue
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5" />
        <h2 className="text-xl font-semibold">Settings</h2>
        {showDevSettings && (
          <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded">
            DEV MODE
          </span>
        )}
      </div>
      
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium mb-4">API Configuration</h3>
          <div className="space-y-4">
            {providers.map((provider) => (
              <ApiKeyManager key={provider} provider={provider} />
            ))}
          </div>
        </div>

        {/* Hidden Developer Settings - only shown in dev mode */}
        {showDevSettings && (
          <div className="border-t pt-8 bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-orange-700 dark:text-orange-300">
                Developer Settings
              </h3>
              <button
                onClick={() => {
                  setShowDevSettings(false)
                  localStorage.removeItem('omnimind-dev-mode')
                }}
                className="text-xs text-orange-600 hover:text-orange-800 underline"
              >
                Hide Dev Settings
              </button>
            </div>
            <p className="text-sm text-orange-600 dark:text-orange-400 mb-4">
              These settings are hidden from normal users. Access with Ctrl+Shift+D or ?dev=true
            </p>
            <EnhancementSettings />
          </div>
        )}
        
        <div className="text-sm text-muted-foreground">
          <p>
            API keys are stored securely in your browser and never sent to our servers.
            They are only used to communicate directly with the respective AI providers.
          </p>
          {!showDevSettings && (
            <p className="text-xs text-muted-foreground/60 mt-2">
              Press Ctrl+Shift+D for developer options
            </p>
          )}
        </div>
      </div>
    </div>
  )
}