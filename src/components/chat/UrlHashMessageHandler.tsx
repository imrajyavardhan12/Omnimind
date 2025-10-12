'use client'

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/lib/stores/chat'
import { useViewModeStore } from '@/lib/stores/viewMode'

/**
 * URL Hash Message Handler
 * 
 * Automatically populates and sends messages from URL hash
 * Example: https://omnimind.com/#SGVsbG8gd29ybGQ=
 * The hash is base64 encoded message that will be auto-sent
 * 
 * Use case: Shareable comparison links, demo links, testing
 */
export function UrlHashMessageHandler() {
  const hasProcessed = useRef(false)
  const { createSession, activeSessionId } = useChatStore()
  const { viewMode } = useViewModeStore()

  useEffect(() => {
    // Only process once and only on client side
    if (hasProcessed.current || typeof window === 'undefined') {
      return
    }

    const processHashMessage = () => {
      try {
        const hash = window.location.hash

        // No hash or empty hash
        if (!hash || hash.length <= 1) {
          return
        }

        // Remove the # symbol
        const encodedMessage = hash.slice(1)

        try {
          // Decode base64
          const decodedMessage = atob(encodedMessage)

          if (decodedMessage) {
            console.log('📝 Processing message from URL hash', {
              messageLength: decodedMessage.length,
              viewMode,
            })

            // Mark as processed
            hasProcessed.current = true

            // Create session if none exists
            if (!activeSessionId) {
              createSession()
            }

            // Store the message in sessionStorage for the chat input to pick up
            // We can't directly send from here because we need the chat hooks
            sessionStorage.setItem('omnimind_auto_message', decodedMessage)

            // Clean up the URL (remove hash without page reload)
            window.history.replaceState(
              null,
              '',
              window.location.pathname + window.location.search
            )

            // Dispatch custom event to notify chat components
            window.dispatchEvent(new CustomEvent('omnimind:auto-message'))
          }
        } catch (decodeError) {
          console.warn('⚠️ Invalid base64 encoding in URL hash', {
            error: decodeError instanceof Error ? decodeError.message : 'Unknown error',
          })
        }
      } catch (error) {
        console.error('❌ Failed to process URL hash message', error)
      }
    }

    // Small delay to ensure stores are hydrated
    const timer = setTimeout(processHashMessage, 100)

    return () => clearTimeout(timer)
  }, [createSession, activeSessionId, viewMode])

  // This component doesn't render anything
  return null
}

/**
 * Helper function to create shareable links
 * Usage: createShareableLink("Compare GPT-4 vs Claude on this prompt")
 */
export function createShareableLink(message: string): string {
  const encoded = btoa(message)
  return `${window.location.origin}${window.location.pathname}#${encoded}`
}
