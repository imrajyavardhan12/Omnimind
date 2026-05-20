'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Settings, X, RotateCcw } from 'lucide-react'
import { useModelTabsStore, SelectedModel, ModelSettings } from '@/lib/stores/modelTabs'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/portal'

interface ModelSettingsModalProps {
  selectedModel: SelectedModel
  className?: string
}

export function ModelSettingsModal({ selectedModel, className }: ModelSettingsModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { updateModelSettings, defaultSettings } = useModelTabsStore()
  
  const safeDefaultSettings = useMemo(() => 
    defaultSettings || { temperature: 0.7, maxTokens: 2048, systemPrompt: '' }, 
    [defaultSettings]
  )
  
  const [localSettings, setLocalSettings] = useState<ModelSettings>(() => 
    selectedModel.settings || { ...safeDefaultSettings }
  )
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedModel.settings) {
      setLocalSettings(selectedModel.settings)
    } else {
      setLocalSettings({ ...safeDefaultSettings })
    }
  }, [selectedModel.settings, safeDefaultSettings])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        if (isOpen) {
          updateModelSettings(selectedModel.id, localSettings)
        }
        setIsOpen(false)
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        updateModelSettings(selectedModel.id, localSettings)
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscapeKey)
      }
    }
  }, [isOpen, localSettings, selectedModel.id, updateModelSettings])

  const handleSave = () => {
    updateModelSettings(selectedModel.id, localSettings)
    setIsOpen(false)
  }

  const handleReset = () => {
    setLocalSettings({ ...safeDefaultSettings })
    updateModelSettings(selectedModel.id, safeDefaultSettings)
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="p-1 hover:bg-black/10 rounded transition-colors"
        title={`Settings for ${selectedModel.model.name}`}
      >
        <Settings className="w-3 h-3" />
      </button>

      {isOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div ref={modalRef} className="bg-background border border-border rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-x-hidden overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="font-semibold text-lg text-foreground">{selectedModel.model.name}</h3>
                <p className="text-xs text-muted-foreground">Model Settings</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-accent rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 min-w-0">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Temperature ({localSettings?.temperature ?? 0.7})
                </label>
                <div className="px-1">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={localSettings?.temperature ?? 0.7}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(2, parseFloat(e.target.value)))
                      setLocalSettings(prev => ({ ...prev, temperature: value }))
                    }}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>Focused (0)</span>
                  <span>Balanced (1)</span>
                  <span>Creative (2)</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Max Tokens ({(localSettings?.maxTokens ?? 2048).toLocaleString()})
                </label>
                <div className="px-1">
                  <input
                    type="range"
                    min="1"
                    max="8192"
                    step="100"
                    value={localSettings?.maxTokens ?? 2048}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(8192, parseInt(e.target.value)))
                      setLocalSettings(prev => ({ ...prev, maxTokens: value }))
                    }}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>1</span>
                  <span>8,192</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">System Prompt</label>
                <textarea
                  value={localSettings?.systemPrompt ?? ''}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="Enter system instructions for this model..."
                  className="w-full h-24 p-3 text-sm border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  {(localSettings?.systemPrompt ?? '').length} characters
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-border">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
          </div>
        </Portal>
      )}
    </>
  )
}