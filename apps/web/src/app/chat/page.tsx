'use client'

import { useState, useEffect } from 'react'

// Force dynamic rendering for this page (uses client-side auth and state)
export const dynamic = 'force-dynamic'
import { Settings, RotateCcw, LogOut, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser, useClerk } from '@clerk/nextjs'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { ExportButton } from '@/components/chat/ExportButton'
import { ConversationSidebar } from '@/components/history/ConversationSidebar'
import { ViewModeToggle } from '@/components/ui/ViewModeToggle'
import { OnboardingModal } from '@/components/OnboardingModal'
import { UrlHashMessageHandler } from '@/components/chat/UrlHashMessageHandler'
import { ModelCommandPalette } from '@/components/chat/ModelCommandPalette'
import { CouncilInterface } from '@/components/council'
import { RunChatView } from '@/features/chat/components/RunChatView'
import { useViewModeStore } from '@/lib/stores/viewMode'
import { useChatStore } from '@/lib/stores/chat'

export default function Home() {
  const [showSettings, setShowSettings] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showModelPalette, setShowModelPalette] = useState(false)
  const { viewMode } = useViewModeStore()
  const { createSession } = useChatStore()
  const { user } = useUser()
  const { signOut } = useClerk()

  // RunChatView (backend runs) is now the ONLY single/compare path. Its own
  // sidebar + "New chat" replace the legacy Export/Clear/ConversationSidebar,
  // which drive the legacy localStorage store — keep those only for Council (M8).
  const hideLegacyChatControls = viewMode !== 'council'

  // Onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('omnimind_onboarding_completed')
    if (!hasSeenOnboarding && user) {
      const timer = setTimeout(() => setShowOnboarding(true), 500)
      return () => clearTimeout(timer)
    }
  }, [user])

  // Model command palette (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowModelPalette(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Logo click closes settings
  useEffect(() => {
    const handleCloseSettings = () => setShowSettings(false)
    window.addEventListener('omnimind:close-settings', handleCloseSettings)
    return () => window.removeEventListener('omnimind:close-settings', handleCloseSettings)
  }, [])

  const handleSignOut = async () => {
    setShowUserMenu(false)
    await signOut({ redirectUrl: '/auth/login' })
  }

  // Clear conversation (Council only — legacy localStorage store)
  const clearConversation = () => {
    createSession()
  }

  return (
    <div className="flex h-full overflow-x-hidden">
      <UrlHashMessageHandler />

      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}

      <ModelCommandPalette
        isOpen={showModelPalette}
        onClose={() => setShowModelPalette(false)}
        singleMode={viewMode === 'single'}
      />

      {/* Legacy localStorage sidebar — only for Council; the run view has its own. */}
      {!hideLegacyChatControls && (
        <div className="hidden lg:block">
          <ConversationSidebar />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 h-full overflow-hidden border-l border-border">
        {showSettings ? (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-6 pb-4 border-b border-border bg-background">
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
            <div className="flex-1 overflow-y-auto p-6 pt-4">
              <SettingsPanel />
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-3 sm:p-6 pb-2 sm:pb-4 bg-background">
              <div className="flex items-center gap-4">
                <ViewModeToggle />
              </div>

              <div className="flex gap-2 items-center">
                {!hideLegacyChatControls && <ExportButton />}
                {!hideLegacyChatControls && (
                  <button
                    onClick={clearConversation}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm border border-border rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                    title="Clear conversation"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Settings</span>
                </button>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
                    title={user?.primaryEmailAddress?.emailAddress || 'User'}
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden md:inline max-w-[150px] truncate">{user?.primaryEmailAddress?.emailAddress}</span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-background border border-border rounded-md shadow-lg z-50">
                      <div className="p-3 border-b border-border">
                        <p className="text-sm font-medium">{user?.primaryEmailAddress?.emailAddress}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          User ID: {user?.id?.slice(0, 8)}...
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          window.location.href = '/dashboard'
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
                      >
                        <User className="w-4 h-4" />
                        Dashboard
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* View-mode content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">
                {viewMode === 'single' ? (
                  <motion.div
                    key="single-mode"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    <RunChatView mode="single" className="h-full" />
                  </motion.div>
                ) : viewMode === 'council' ? (
                  <motion.div
                    key="council-mode"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    <CouncilInterface className="h-full" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="compare-mode"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    <RunChatView mode="compare" className="h-full" />
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
