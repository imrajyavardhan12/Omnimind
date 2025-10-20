'use client'

import Image from 'next/image'
import { FileAttachment } from '@/lib/types'
import { getFileIcon, formatFileSize, getFileCategory } from '@/lib/utils/fileUpload'

interface MessageAttachmentsProps {
  attachments: FileAttachment[]
  className?: string
}

export function MessageAttachments({ attachments, className }: MessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) {
    return null
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {attachments.map((file) => {
        const category = getFileCategory(file.type)
        const hasData = file.data && file.url
        const wasCleared = file._dataPersisted === false || (!hasData && file._dataPersisted === undefined)
        
        return (
          <div key={file.id} className="border rounded-lg p-3 bg-muted">
            {category === 'images' ? (
              <div className="space-y-2">
                {hasData ? (
                  <div className="relative w-full max-w-sm">
                    <Image
                      src={file.url!}
                      alt={file.name}
                      width={300}
                      height={200}
                      className="rounded object-cover w-full h-auto max-h-48"
                    />
                  </div>
                ) : (
                  <div className="relative w-full max-w-sm p-4 border-2 border-dashed border-border rounded bg-amber-500/10 flex flex-col items-center justify-center text-amber-600 dark:text-amber-400">
                    <span className="text-sm font-medium">📎 Image data not loaded</span>
                    {wasCleared && (
                      <span className="text-xs mt-1 text-center">
                        Attachment was cleared to save space. Re-upload if needed.
                      </span>
                    )}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  <div className="font-medium">{file.name}</div>
                  <div>{formatFileSize(file.size)}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getFileIcon(file.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} • {file.type}
                  </div>
                  {wasCleared && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ File data cleared to save space
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}