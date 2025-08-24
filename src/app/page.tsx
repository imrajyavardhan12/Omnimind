'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { SessionStats } from '@/components/chat/SessionStats'
import { ExportButton } from '@/components/chat/ExportButton'
import { ConversationSidebar } from '@/components/history/ConversationSidebar'
import { ModelTabBar } from '@/components/chat/ModelTabBar'
import { DynamicChatPanel } from '@/components/chat/DynamicChatPanel'
import { TabifiedUnifiedInput } from '@/components/chat/TabifiedUnifiedInput'
import { useModelTabsStore } from '@/lib/stores/modelTabs'

export default function Home() {
  const [showSettings, setShowSettings] = useState(false)
  const { selectedModels } = useModelTabsStore()
  
  // Dynamic grid class - force all models into single row
  const getGridClass = (count: number) => {
    switch (count) {
      case 1: return 'grid-cols-1'
      case 2: return 'grid-cols-2'
      case 3: return 'grid-cols-3'
      case 4: return 'grid-cols-4'
      case 5: return 'grid-cols-5'
      default: return 'grid-cols-1'
    }
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      {/* Sidebar */}
      <ConversationSidebar />
      
      {/* Main Content */}
      <div className="flex-1 min-w-0 overflow-x-hidden">
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
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-end">
              <div className="flex gap-2">
                <ExportButton />
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-accent"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              <SessionStats />
              
              {/* Model Tab Bar */}
              <ModelTabBar />
              
              {/* Dynamic Grid for Selected Models */}
              <div className={`grid ${getGridClass(selectedModels.length)} gap-4 w-full overflow-hidden`}>
                {selectedModels.map((selectedModel) => (
                  <DynamicChatPanel 
                    key={selectedModel.id} 
                    selectedModel={selectedModel}
                    className="h-[600px] min-w-0" 
                  />
                ))}
              </div>
              
              {/* Show message if no models selected */}
              {selectedModels.length === 0 && (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <div className="text-muted-foreground">
                    <p className="text-lg mb-2">No models selected</p>
                    <p className="text-sm">
                      Click &quot;Add Model&quot; in the tab bar above to start comparing AI responses
                    </p>
                  </div>
                </div>
              )}
              
              {/* Tabified Unified Input */}
              <TabifiedUnifiedInput />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}