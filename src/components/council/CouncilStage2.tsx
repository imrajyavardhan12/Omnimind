'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, AlertCircle, Trophy, Medal } from 'lucide-react'
import { PeerRanking, AggregateRanking } from '@/lib/stores/council'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import { cn } from '@/lib/utils'

interface CouncilStage2Props {
  rankings: PeerRanking[]
  aggregateRankings: AggregateRanking[]
  isActive: boolean
  totalModels: number
}

export function CouncilStage2({ rankings, aggregateRankings, isActive, totalModels }: CouncilStage2Props) {
  const [activeTab, setActiveTab] = useState<'aggregate' | number>('aggregate')
  
  const allComplete = rankings.length === totalModels && rankings.every(r => !r.isLoading && !r.error)
  const hasErrors = rankings.some(r => r.error)
  
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-500'
      case 2: return 'text-gray-400'
      case 3: return 'text-amber-600'
      default: return 'text-muted-foreground'
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-500" />
      case 2: return <Medal className="w-5 h-5 text-gray-400" />
      case 3: return <Medal className="w-5 h-5 text-amber-600" />
      default: return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground font-bold">#{rank}</span>
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border overflow-hidden",
        isActive ? "border-blue-500/50 bg-blue-500/5" : "border-border bg-background"
      )}
    >
      {/* Stage Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            allComplete ? "bg-green-500 text-white" : 
            hasErrors ? "bg-red-500 text-white" :
            isActive ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
          )}>
            {allComplete ? <CheckCircle2 className="w-4 h-4" /> : 
             hasErrors ? <AlertCircle className="w-4 h-4" /> : "2"}
          </div>
          <div>
            <h3 className="font-semibold">Stage 2: Peer Review</h3>
            <p className="text-xs text-muted-foreground">
              Council members evaluate each other&apos;s responses anonymously
            </p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {rankings.filter(r => !r.isLoading).length} / {totalModels} reviews
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('aggregate')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
            activeTab === 'aggregate' 
              ? "border-blue-500 text-foreground bg-muted/30" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
          )}
        >
          <Trophy className="w-4 h-4" />
          Aggregate Rankings
        </button>
        {rankings.map((ranking, index) => (
          <button
            key={ranking.reviewerModelId}
            onClick={() => setActiveTab(index)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
              activeTab === index 
                ? "border-blue-500 text-foreground bg-muted/30" 
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
            )}
          >
            <span>{ranking.reviewerModelName}</span>
            {ranking.isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            {!ranking.isLoading && !ranking.error && <CheckCircle2 className="w-3 h-3 text-green-500" />}
            {ranking.error && <AlertCircle className="w-3 h-3 text-red-500" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'aggregate' ? (
            <motion.div
              key="aggregate"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {aggregateRankings.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm text-muted-foreground">
                      Waiting for peer reviews...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground mb-4">
                    Final Rankings (by average position)
                  </h4>
                  {aggregateRankings
                    .sort((a, b) => a.averageRank - b.averageRank)
                    .map((ranking, index) => (
                      <motion.div
                        key={ranking.modelId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={cn(
                          "flex items-center gap-4 p-3 rounded-lg border",
                          index === 0 ? "bg-yellow-500/10 border-yellow-500/30" :
                          index === 1 ? "bg-gray-500/10 border-gray-500/30" :
                          index === 2 ? "bg-amber-500/10 border-amber-500/30" :
                          "bg-muted/30 border-border"
                        )}
                      >
                        {getRankIcon(index + 1)}
                        <div className="flex-1">
                          <div className="font-medium">{ranking.modelName}</div>
                          <div className="text-xs text-muted-foreground">
                            Response {ranking.label}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn("font-bold", getRankColor(index + 1))}>
                            #{index + 1}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Avg: {ranking.averageRank.toFixed(2)}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {rankings[activeTab as number]?.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm text-muted-foreground">
                      {rankings[activeTab as number]?.reviewerModelName} is evaluating...
                    </p>
                  </div>
                </div>
              ) : rankings[activeTab as number]?.error ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                    <p className="text-sm text-red-500">{rankings[activeTab as number]?.error}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Rankings summary */}
                  <div className="flex flex-wrap gap-2 pb-4 border-b border-border">
                    {rankings[activeTab as number]?.rankings
                      .sort((a, b) => a.rank - b.rank)
                      .map((r) => (
                        <div
                          key={r.modelId}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium",
                            r.rank === 1 ? "bg-yellow-500/20 text-yellow-600" :
                            r.rank === 2 ? "bg-gray-500/20 text-gray-600" :
                            "bg-muted text-muted-foreground"
                          )}
                        >
                          #{r.rank} {r.label}
                        </div>
                      ))}
                  </div>
                  
                  {/* Full evaluation */}
                  <MarkdownRenderer content={rankings[activeTab as number]?.evaluation || ''} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
