'use client'

import { useState } from 'react'
import { Sliders, RotateCcw, Info } from 'lucide-react'
import { useSettingsStore } from '@/lib/stores/settings'
import { cn } from '@/lib/utils'

interface ModelParametersProps {
  className?: string
}

export function ModelParameters({ className }: ModelParametersProps) {
  const { 
    temperature, 
    maxTokens, 
    setTemperature, 
    setMaxTokens 
  } = useSettingsStore()

  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleTemperatureChange = (value: number) => {
    setTemperature(Number(value))
  }

  const handleMaxTokensChange = (value: number) => {
    setMaxTokens(Number(value))
  }

  const resetToDefaults = () => {
    setTemperature(0.7)
    setMaxTokens(1000)
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5" />
          <h3 className="text-lg font-medium">Model Parameters</h3>
        </div>
        <button
          onClick={resetToDefaults}
          className="flex items-center gap-2 px-3 py-1 text-sm border border-border rounded-md hover:bg-accent"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      <div className="space-y-6">
        {/* Temperature Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Temperature
            </label>
            <span className="text-sm text-muted-foreground font-mono">
              {temperature.toFixed(2)}
            </span>
          </div>
          
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.0 (Focused)</span>
              <span>1.0 (Balanced)</span>
              <span>2.0 (Creative)</span>
            </div>
          </div>
          
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Controls randomness. Lower values make responses more focused and deterministic. 
              Higher values make responses more creative and varied.
            </p>
          </div>
        </div>

        {/* Max Tokens Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Max Tokens
            </label>
            <span className="text-sm text-muted-foreground font-mono">
              {maxTokens.toLocaleString()}
            </span>
          </div>
          
          <div className="space-y-2">
            <input
              type="range"
              min="100"
              max="4000"
              step="100"
              value={maxTokens}
              onChange={(e) => handleMaxTokensChange(parseInt(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>100 (Brief)</span>
              <span>1000 (Medium)</span>
              <span>4000 (Long)</span>
            </div>
          </div>
          
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Maximum length of the response. Higher values allow longer responses but cost more. 
              Actual response may be shorter.
            </p>
          </div>
        </div>

        {/* Advanced Parameters Toggle */}
        <div className="pt-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sliders className="w-3 h-3" />
            Advanced Parameters
            <span className="text-xs">
              {showAdvanced ? '(Hide)' : '(Show)'}
            </span>
          </button>
          
          {showAdvanced && (
            <div className="mt-4 p-4 border border-border rounded-lg space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2 font-medium">Coming Soon:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Top P (nucleus sampling)</li>
                  <li>• Frequency penalty</li>
                  <li>• Presence penalty</li>
                  <li>• Stop sequences</li>
                  <li>• System prompts</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-medium mb-3">Quick Presets</h4>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              setTemperature(0.3)
              setMaxTokens(500)
            }}
            className="p-2 text-xs border border-border rounded-md hover:bg-accent text-left"
          >
            <div className="font-medium">Focused</div>
            <div className="text-muted-foreground">T: 0.3, Max: 500</div>
          </button>
          
          <button
            onClick={() => {
              setTemperature(0.7)
              setMaxTokens(1000)
            }}
            className="p-2 text-xs border border-border rounded-md hover:bg-accent text-left"
          >
            <div className="font-medium">Balanced</div>
            <div className="text-muted-foreground">T: 0.7, Max: 1000</div>
          </button>
          
          <button
            onClick={() => {
              setTemperature(1.2)
              setMaxTokens(2000)
            }}
            className="p-2 text-xs border border-border rounded-md hover:bg-accent text-left"
          >
            <div className="font-medium">Creative</div>
            <div className="text-muted-foreground">T: 1.2, Max: 2000</div>
          </button>
        </div>
      </div>
    </div>
  )
}