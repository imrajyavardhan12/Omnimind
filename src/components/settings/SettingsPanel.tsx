'use client'

import { Settings } from 'lucide-react'
import { ProviderName } from '@/lib/types'
import { ApiKeyManager } from './ApiKeyManager'

interface SettingsPanelProps {
  className?: string
}

const providers: ProviderName[] = ['openai', 'anthropic', 'gemini', 'openrouter']

export function SettingsPanel({ className }: SettingsPanelProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5" />
        <h2 className="text-xl font-semibold">Settings</h2>
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
        
        <div className="text-sm text-muted-foreground">
          <p>
            API keys are stored securely in your browser and never sent to our servers.
            They are only used to communicate directly with the respective AI providers.
          </p>
        </div>
      </div>
    </div>
  )
}