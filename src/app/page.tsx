'use client'

import { useState, useEffect } from 'react'
import { Settings, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { SessionStats } from '@/components/chat/SessionStats'
import { ExportButton } from '@/components/chat/ExportButton'
import { ConversationSidebar } from '@/components/history/ConversationSidebar'
import { ModelTabBar } from '@/components/chat/ModelTabBar'
import { DynamicChatPanel } from '@/components/chat/DynamicChatPanel'
import { AnimatedUnifiedInput } from '@/components/chat/AnimatedUnifiedInput'
import { SingleChatInterface } from '@/components/chat/SingleChatInterface'
import { ViewModeToggle } from '@/components/ui/ViewModeToggle'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { useViewModeStore } from '@/lib/stores/viewMode'
import { useChatStore } from '@/lib/stores/chat'

export default function Home() {
  const [showSettings, setShowSettings] = useState(false)
  const { selectedModels } = useModelTabsStore()
  const { viewMode, isHeaderVisible, setIsHeaderVisible, toggleHeaderVisibility } = useViewModeStore()
  const { isLoading, getActiveSession, createSession } = useChatStore()
  
  // Auto-hide header during response generation (compare mode only)
  useEffect(() => {
    if (viewMode === 'compare') {
      const isAnyLoading = Object.values(isLoading).some(loading => loading)
      const session = getActiveSession()
      if (isAnyLoading && session?.messages && session.messages.length > 0) {
        setIsHeaderVisible(false)
      }
    }
  }, [isLoading, viewMode, getActiveSession, setIsHeaderVisible])

  // Use the shared toggle function from the store
  const toggleHeader = toggleHeaderVisibility

  // Clear conversation function
  const clearConversation = () => {
    createSession() // Creates a new session, effectively clearing the current one
  }
  
  // Dynamic grid class - responsive for mobile
  const getGridClass = (count: number) => {
    // Mobile first: 1 column on mobile, then adapt for larger screens
    switch (count) {
      case 1: return 'grid-cols-1'
      case 2: return 'grid-cols-1 md:grid-cols-2'
      case 3: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      case 4: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      case 5: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
      default: return 'grid-cols-1'
    }
  }

  return (
    <div className="flex h-full overflow-x-hidden">
      {/* Sidebar - hidden on mobile, visible on desktop */}
      <div className="hidden lg:block">
        <ConversationSidebar />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 min-w-0 h-full overflow-hidden border-l border-border">
        {showSettings ? (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-medium">Settings</h2>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent"
              >
                Back to Chat
              </button>
            </div>
            <SettingsPanel />
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header with View Mode Toggle and Settings */}
            <div className="flex-shrink-0 flex items-center justify-between p-3 sm:p-6 pb-2 sm:pb-4 bg-background">
              <div className="flex items-center gap-4">
                <ViewModeToggle />
              </div>
              
              <div className="flex gap-2">
                <ExportButton />
                <button
                  onClick={clearConversation}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm border border-border rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              </div>
            </div>

            {/* Dynamic Content Based on View Mode with AnimatePresence */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">
                {viewMode === 'single' ? (
                  /* Single Chat Interface - ChatGPT Style */
                  <motion.div
                    key="single-mode"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    <SingleChatInterface className="h-full" />
                  </motion.div>
                ) : (
                  /* Compare Mode - Multi-Model Grid */
                  <motion.div
                    key="compare-mode"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="relative h-full"
                  >
                    {/* Collapsible Header with smoother animation */}
                    <AnimatePresence initial={false}>
                      {isHeaderVisible && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ 
                            height: "auto", 
                            opacity: 1,
                            transition: {
                              height: {
                                duration: 0.3,
                                ease: [0.4, 0, 0.2, 1]
                              },
                              opacity: {
                                duration: 0.2,
                                delay: 0.1
                              }
                            }
                          }}
                          exit={{ 
                            height: 0, 
                            opacity: 0,
                            transition: {
                              height: {
                                duration: 0.25,
                                ease: [0.4, 0, 0.2, 1]
                              },
                              opacity: {
                                duration: 0.15
                              }
                            }
                          }}
                          className="relative z-10 overflow-hidden bg-background"
                        >
                          {/* Session Stats */}
                          <div className="px-6 py-4">
                            <SessionStats />
                          </div>

                          {/* Model Tab Bar */}
                          <ModelTabBar />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Header Toggle Button - Always visible */}
                    <div className="relative z-10 flex justify-center py-2 border-b border-border/20 bg-background">
                      <button
                        onClick={toggleHeader}
                        className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                      >
                        {isHeaderVisible ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            Hide Controls
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            Show Controls
                          </>
                        )}
                      </button>
                    </div>

                    {/* Scrollable content area with bottom padding for input */}
                    <div 
                      className="overflow-y-auto pb-40"
                      style={{
                        height: `calc(100% - ${isHeaderVisible ? '160px' : '48px'})`
                      }}
                    >
                      <div className="p-3 sm:p-6 pt-0 space-y-4 sm:space-y-6">
                        <div className="space-y-6">
                          {/* Dynamic Grid for Selected Models */}
                          <div className={`grid ${getGridClass(selectedModels.length)} gap-2 sm:gap-4 w-full overflow-hidden`}>
                            {selectedModels.map((selectedModel) => (
                              <DynamicChatPanel 
                                key={selectedModel.id} 
                                selectedModel={selectedModel}
                                className="h-[400px] sm:h-[500px] lg:h-[600px] min-w-0" 
                              />
                            ))}
                          </div>
                          
                          {/* Show message if no models selected */}
                          {selectedModels.length === 0 && (
                            <div className="text-center py-8 sm:py-12 border border-dashed border-border rounded-lg mx-2 sm:mx-0">
                              <div className="text-muted-foreground px-4">
                                <p className="text-base sm:text-lg mb-2">No models selected</p>
                                <p className="text-xs sm:text-sm">
                                  Click &quot;Add Model&quot; in the tab bar above to start comparing AI responses
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Fixed Animated Unified Input */}
                    <div className="absolute bottom-0 left-0 right-0 z-20">
                      <AnimatedUnifiedInput />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}