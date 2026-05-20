'use client'

import { useState } from 'react'
import { Download, FileText, FileJson, Sheet, Check } from 'lucide-react'
import { useChatStore } from '@/lib/stores/chat'
import { exportSession, downloadFile, generateFilename, ExportOptions } from '@/lib/utils/export'
import { useIsClient } from '@/hooks/useIsClient'
import { cn } from '@/lib/utils'

interface ExportButtonProps {
  className?: string
}

export function ExportButton({ className }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [includeStats, setIncludeStats] = useState(true)
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const { getActiveSession } = useChatStore()
  const isClient = useIsClient()
  
  const session = getActiveSession()

  if (!isClient || !session || session.messages.length === 0) {
    return null
  }

  const handleExport = (format: 'json' | 'markdown' | 'csv') => {
    const options: ExportOptions = {
      format,
      includeStats,
      includeMetadata
    }

    try {
      const content = exportSession(session, options)
      const filename = generateFilename(session, format === 'markdown' ? 'md' : format)
      
      const mimeTypes = {
        json: 'application/json',
        markdown: 'text/markdown',
        csv: 'text/csv'
      }
      
      downloadFile(content, filename, mimeTypes[format])
      setIsOpen(false)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export conversation. Please try again.')
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-accent text-sm"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-lg z-20 p-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-3">Export Conversation</h3>
                
                <div className="space-y-2 mb-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeStats}
                      onChange={(e) => setIncludeStats(e.target.checked)}
                      className="rounded"
                    />
                    Include token & cost statistics
                  </label>
                  
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeMetadata}
                      onChange={(e) => setIncludeMetadata(e.target.checked)}
                      className="rounded"
                    />
                    Include session metadata
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Choose Format:
                </div>
                
                <button
                  onClick={() => handleExport('markdown')}
                  className="w-full flex items-center gap-3 p-3 border border-border rounded-md hover:bg-accent text-left"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="font-medium text-sm">Markdown</div>
                    <div className="text-xs text-muted-foreground">
                      Human-readable format, great for sharing
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleExport('json')}
                  className="w-full flex items-center gap-3 p-3 border border-border rounded-md hover:bg-accent text-left"
                >
                  <FileJson className="w-4 h-4 text-green-500" />
                  <div>
                    <div className="font-medium text-sm">JSON</div>
                    <div className="text-xs text-muted-foreground">
                      Structured data, perfect for analysis
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleExport('csv')}
                  className="w-full flex items-center gap-3 p-3 border border-border rounded-md hover:bg-accent text-left"
                >
                  <Sheet className="w-4 h-4 text-orange-500" />
                  <div>
                    <div className="font-medium text-sm">CSV</div>
                    <div className="text-xs text-muted-foreground">
                      Spreadsheet format, easy to analyze
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}