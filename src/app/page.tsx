'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
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

export default function Home() {
  const [showSettings, setShowSettings] = useState(false)
  const { selectedModels } = useModelTabsStore()
  const { viewMode } = useViewModeStore()
  
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
              <ViewModeToggle />
              
              <div className="flex gap-2">
                <ExportButton />
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              </div>
            </div>

            {/* Dynamic Content Based on View Mode */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {viewMode === 'single' ? (
                /* Single Chat Interface - ChatGPT Style */
                <SingleChatInterface className="h-full" />
              ) : (
                /* Compare Mode - Multi-Model Grid */
                <div className="p-3 sm:p-6 pt-0 space-y-4 sm:space-y-6 h-full overflow-y-auto">
                  <div className="space-y-6">
                    <SessionStats />
                    
                    {/* Model Tab Bar */}
                    <ModelTabBar />
                    
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
                    
                    {/* Animated Unified Input */}
                    <AnimatedUnifiedInput />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}