'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { useEnhancementPreferences } from '@/lib/stores/enhancement'

export function EnhancementSettings() {
  const { preferences, updatePreferences } = useEnhancementPreferences()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Prompt Enhancement</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure how the AI prompt enhancement feature behaves
        </p>
      </div>

      <div className="space-y-4">
        {/* Auto Enhancement Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="auto-enhance">Auto-enhance prompts</Label>
            <p className="text-xs text-muted-foreground">
              Automatically show enhancement suggestions for longer prompts
            </p>
          </div>
          <input
            id="auto-enhance"
            type="checkbox"
            checked={preferences.autoEnhance}
            onChange={(e) => updatePreferences({ autoEnhance: e.target.checked })}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
        </div>

        {/* Auto Expand Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="auto-expand">Auto-expand for low quality</Label>
            <p className="text-xs text-muted-foreground">
              Automatically expand enhancement panel for prompts with quality issues
            </p>
          </div>
          <input
            id="auto-expand"
            type="checkbox"
            checked={preferences.autoExpand}
            onChange={(e) => updatePreferences({ autoExpand: e.target.checked })}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
        </div>

        {/* Show Analysis Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="show-analysis">Show detailed analysis</Label>
            <p className="text-xs text-muted-foreground">
              Display prompt analysis details and quality metrics
            </p>
          </div>
          <input
            id="show-analysis"
            type="checkbox"
            checked={preferences.showAnalysis}
            onChange={(e) => updatePreferences({ showAnalysis: e.target.checked })}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
        </div>

        {/* Quality Threshold Slider */}
        <div className="space-y-2">
          <Label htmlFor="quality-threshold">
            Quality threshold for auto-expand: {preferences.qualityThreshold}
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            Enhancement panel will auto-expand for prompts below this quality score
          </p>
          <input
            id="quality-threshold"
            type="range"
            min="0"
            max="100"
            step="10"
            value={preferences.qualityThreshold}
            onChange={(e) => updatePreferences({ qualityThreshold: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 (Always)</span>
            <span>50</span>
            <span>100 (Never)</span>
          </div>
        </div>

        {/* Enhancement Type Preferences */}
        <div className="space-y-2">
          <Label>Preferred enhancement types</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Select which types of enhancements to show by default
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { id: 'detailed', label: 'Detailed', description: 'Comprehensive enhancements' },
              { id: 'focused', label: 'Focused', description: 'Concise improvements' },
              { id: 'provider-optimized', label: 'Provider-optimized', description: 'Model-specific' },
              { id: 'structured', label: 'Structured', description: 'Step-by-step format' }
            ].map((type) => (
              <label key={type.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-accent cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.preferredTypes.includes(type.id)}
                  onChange={(e) => {
                    const newTypes = e.target.checked
                      ? [...preferences.preferredTypes, type.id]
                      : preferences.preferredTypes.filter(t => t !== type.id)
                    updatePreferences({ preferredTypes: newTypes })
                  }}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}