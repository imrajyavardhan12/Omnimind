'use client'

import { useSettingsStore } from '@/lib/stores/settings'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ChatSettings() {
  const { 
    messagesInContext, 
    setMessagesInContext,
    responseLanguage,
    setResponseLanguage
  } = useSettingsStore()

  const contextOptions = [
    { value: 0, label: 'All messages' },
    { value: 5, label: 'Last 5 messages' },
    { value: 10, label: 'Last 10 messages' },
    { value: 20, label: 'Last 20 messages' },
    { value: 50, label: 'Last 50 messages' },
  ]

  const languageOptions = [
    { value: 'none', label: 'No preference' },
    { value: 'English', label: 'English' },
    { value: 'Spanish', label: 'Spanish (Español)' },
    { value: 'French', label: 'French (Français)' },
    { value: 'German', label: 'German (Deutsch)' },
    { value: 'Italian', label: 'Italian (Italiano)' },
    { value: 'Portuguese', label: 'Portuguese (Português)' },
    { value: 'Chinese', label: 'Chinese (中文)' },
    { value: 'Japanese', label: 'Japanese (日本語)' },
    { value: 'Korean', label: 'Korean (한국어)' },
    { value: 'Russian', label: 'Russian (Русский)' },
    { value: 'Arabic', label: 'Arabic (العربية)' },
    { value: 'Hindi', label: 'Hindi (हिन्दी)' },
  ]

  return (
    <div className="space-y-6">
      {/* Messages in Context */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">Messages in Context</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Limit how many recent messages are sent to the AI. This can significantly reduce costs and improve response times, especially when comparing multiple models.
          </p>
        </div>
        <Select 
          value={messagesInContext.toString()} 
          onValueChange={(value) => setMessagesInContext(parseInt(value))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {contextOptions.map(option => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
                {option.value === 0 && ' (⚠️ Highest cost)'}
                {option.value === 10 && ' (✅ Recommended)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="p-3 bg-muted/50 rounded-md text-xs">
          <p className="font-medium mb-1">💡 Pro tip:</p>
          <p className="text-muted-foreground">
            When comparing multiple models, limiting context can save 50-70% on API costs. 
            For most conversations, 10-20 messages provide enough context.
          </p>
        </div>
      </div>

      {/* Response Language */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">Response Language</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Force AI responses in a specific language. The AI will be instructed to always respond in your chosen language.
          </p>
        </div>
        <Select 
          value={responseLanguage || 'none'} 
          onValueChange={(value) => setResponseLanguage(value === 'none' ? '' : value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languageOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {responseLanguage && responseLanguage !== 'none' && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-xs text-blue-700 dark:text-blue-300">
            AI will respond in <strong>{responseLanguage}</strong>
          </div>
        )}
      </div>
    </div>
  )
}
