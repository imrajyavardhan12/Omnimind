'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { CouncilResponse } from '@/lib/stores/council'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import { cn } from '@/lib/utils'

interface CouncilStage1Props {
  responses: CouncilResponse[]
  isActive: boolean
}

export function CouncilStage1({ responses, isActive }: CouncilStage1Props) {
  const [activeTab, setActiveTab] = useState(0)
  
  const allComplete = responses.every(r => !r.isLoading && !r.error)
  const hasErrors = responses.some(r => r.error)
  
  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      'openai': 'bg-green-500',
      'anthropic': 'bg-orange-500',
      'google-ai-studio': 'bg-blue-500',
      'gemini': 'bg-blue-500',
      'openrouter': 'bg-purple-500'
    }
    return colors[provider] || 'bg-gray-500'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border overflow-hidden",
        isActive ? "border-orange-500/50 bg-orange-500/5" : "border-border bg-background"
      )}
    >
      {/* Stage Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            allComplete ? "bg-green-500 text-white" : 
            hasErrors ? "bg-red-500 text-white" :
            "bg-orange-500 text-white"
          )}>
            {allComplete ? <CheckCircle2 className="w-4 h-4" /> : 
             hasErrors ? <AlertCircle className="w-4 h-4" /> : "1"}
          </div>
          <div>
            <h3 className="font-semibold">Stage 1: Individual Opinions</h3>
            <p className="text-xs text-muted-foreground">
              Each council member provides their perspective
            </p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {responses.filter(r => !r.isLoading).length} / {responses.length} complete
        </div>
      </div>

      {/* Model Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {responses.map((response, index) => (
          <button
            key={response.modelId}
            onClick={() => setActiveTab(index)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
              activeTab === index 
                ? "border-orange-500 text-foreground bg-muted/30" 
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", getProviderColor(response.provider))} />
            <span>{response.modelName}</span>
            {response.isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            {!response.isLoading && !response.error && <CheckCircle2 className="w-3 h-3 text-green-500" />}
            {response.error && <AlertCircle className="w-3 h-3 text-red-500" />}
          </button>
        ))}
      </div>

      {/* Response Content */}
      <div className="p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="wait">
          {responses[activeTab] && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {responses[activeTab].isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    <p className="text-sm text-muted-foreground">
                      {responses[activeTab].modelName} is thinking...
                    </p>
                  </div>
                </div>
              ) : responses[activeTab].error ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                    <p className="text-sm text-red-500">{responses[activeTab].error}</p>
                  </div>
                </div>
              ) : (
                <MarkdownRenderer content={responses[activeTab].response} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
