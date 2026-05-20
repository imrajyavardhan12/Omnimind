'use client'

import { useRef, useState } from 'react'
import { Paperclip, X, Upload } from 'lucide-react'
import { FileAttachment } from '@/lib/types'
import { processFile, formatFileSize, getFileIcon, SUPPORTED_FILE_TYPES } from '@/lib/utils/fileUpload'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFilesSelected: (files: FileAttachment[]) => void
  selectedFiles: FileAttachment[]
  onRemoveFile: (fileId: string) => void
  disabled?: boolean
  className?: string
}

export function FileUpload({ 
  onFilesSelected, 
  selectedFiles, 
  onRemoveFile, 
  disabled = false,
  className 
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsProcessing(true)
    try {
      // Import constants
      const { MAX_TOTAL_FILE_SIZE, MAX_FILES_COUNT } = await import('@/lib/utils/fileUpload')
      
      // Check file count limit
      if (selectedFiles.length + files.length > MAX_FILES_COUNT) {
        throw new Error(`Cannot upload more than ${MAX_FILES_COUNT} files per message. Currently have ${selectedFiles.length} file(s).`)
      }
      
      // Check total size limit including already selected files
      const currentTotalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0)
      const newFilesSize = Array.from(files).reduce((sum, f) => sum + f.size, 0)
      
      if (currentTotalSize + newFilesSize > MAX_TOTAL_FILE_SIZE) {
        throw new Error(`Total file size would exceed ${(MAX_TOTAL_FILE_SIZE / 1024 / 1024).toFixed(0)}MB limit. Currently using ${(currentTotalSize / 1024 / 1024).toFixed(1)}MB`)
      }

      const filePromises = Array.from(files).map(processFile)
      const processedFiles = await Promise.all(filePromises)
      onFilesSelected(processedFiles)
      
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error processing files:', error)
      alert(error instanceof Error ? error.message : 'Failed to process files')
      
      // Reset file input even on error
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !isDragging) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (isDragging) {
      setIsDragging(false)
    }
  }

  const acceptedTypes = Object.values(SUPPORTED_FILE_TYPES).flat().join(',')

  return (
    <div className={cn('space-y-2', className)}>
      {/* File Upload Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isProcessing}
          className="p-2 hover:bg-accent rounded transition-colors disabled:opacity-50"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        
        {isProcessing && (
          <span className="text-xs text-muted-foreground">Processing files...</span>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Drag and Drop Area (when dragging) */}
      {isDragging && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className="fixed inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 flex items-center justify-center z-50"
        >
          <div className="bg-background p-6 rounded-lg shadow-lg text-center border">
            <Upload className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="text-lg font-medium">Drop files here</p>
            <p className="text-sm text-muted-foreground">Images, PDFs, documents supported</p>
          </div>
        </div>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-1">
          {selectedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 p-2 bg-muted rounded text-sm"
            >
              <span className="text-base">{getFileIcon(file.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">{formatFileSize(file.size)}</div>
              </div>
              <button
                onClick={() => onRemoveFile(file.id)}
                className="p-1 hover:bg-accent rounded transition-colors"
                title="Remove file"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Global drag handlers */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="fixed inset-0 pointer-events-none"
      />
    </div>
  )
}