import { FileAttachment } from '../types'

export const SUPPORTED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/mp4'],
  video: ['video/mp4', 'video/mpeg', 'video/quicktime']
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function isFileTypeSupported(fileType: string): boolean {
  return Object.values(SUPPORTED_FILE_TYPES).flat().includes(fileType)
}

export function getFileCategory(fileType: string): string {
  for (const [category, types] of Object.entries(SUPPORTED_FILE_TYPES)) {
    if (types.includes(fileType)) {
      return category
    }
  }
  return 'unknown'
}

export async function processFile(file: File): Promise<FileAttachment> {
  if (!isFileTypeSupported(file.type)) {
    throw new Error(`File type ${file.type} is not supported`)
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = () => {
      const result = reader.result as string
      const base64Data = result.split(',')[1] // Remove data:mime;base64, prefix
      
      const attachment: FileAttachment = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64Data,
        url: result // Keep full data URL for preview
      }
      
      resolve(attachment)
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsDataURL(file)
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getFileIcon(fileType: string): string {
  const category = getFileCategory(fileType)
  
  switch (category) {
    case 'images':
      return '🖼️'
    case 'documents':
      return '📄'
    case 'audio':
      return '🎵'
    case 'video':
      return '🎥'
    default:
      return '📎'
  }
}