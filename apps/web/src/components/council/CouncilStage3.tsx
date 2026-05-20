'use client'

import { motion } from 'framer-motion'
import { Loader2, CheckCircle2, Sparkles, Crown } from 'lucide-react'
import { Model } from '@/lib/types'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import { cn } from '@/lib/utils'

interface CouncilStage3Props {
  synthesis: string
  isLoading: boolean
  chairmanModel: Model | null
  isActive: boolean
}

export function CouncilStage3({ synthesis, isLoading, chairmanModel, isActive }: CouncilStage3Props) {
  const isComplete = !isLoading && synthesis.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border overflow-hidden",
        isActive ? "border-primary/50 bg-primary/5" : "border-border bg-background"
      )}
    >
      {/* Stage Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            isComplete ? "bg-green-500 text-white" : 
            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            {isComplete ? <CheckCircle2 className="w-4 h-4" /> : "3"}
          </div>
          <div>
            <h3 className="font-semibold">Stage 3: Final Synthesis</h3>
            <p className="text-xs text-muted-foreground">
              Chairman synthesizes the council&apos;s wisdom into a final answer
            </p>
          </div>
        </div>
        {chairmanModel && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
            <Crown className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              {chairmanModel.name}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 min-h-[200px]">
        {!isActive && !isComplete ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Waiting for peer review to complete...
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <Crown className="w-5 h-5 text-primary absolute -top-1 -right-1" />
              </div>
              <p className="text-sm text-muted-foreground">
                Chairman is synthesizing the final answer...
              </p>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Final Answer Banner */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">
                  Council&apos;s Final Answer
                </span>
              </div>
            </div>
            
            {/* Synthesized Response */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownRenderer content={synthesis} />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
