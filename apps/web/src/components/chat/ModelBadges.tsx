'use client'

import { Eye, Zap, DollarSign, Sparkles, Star, Code } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VerifiedModel } from '@/lib/models/verified-models'

interface ModelBadgesProps {
  model: VerifiedModel
  className?: string
  size?: 'sm' | 'md'
}

export function ModelBadges({ model, className, size = 'md' }: ModelBadgesProps) {
  const badges = []

  // Recommended badge
  if (model.recommended) {
    badges.push({
      icon: Star,
      label: 'Recommended',
      className: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-950 dark:text-yellow-300 dark:ring-yellow-300/20'
    })
  }

  // Vision support
  if (model.capabilities.vision) {
    badges.push({
      icon: Eye,
      label: 'Vision',
      className: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-950 dark:text-purple-300 dark:ring-purple-300/20'
    })
  }

  // Speed indicator
  if (model.speed === 'very-fast') {
    badges.push({
      icon: Zap,
      label: 'Ultra Fast',
      className: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-300/20'
    })
  } else if (model.speed === 'fast') {
    badges.push({
      icon: Zap,
      label: 'Fast',
      className: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-950 dark:text-cyan-300 dark:ring-cyan-300/20'
    })
  }

  // Free models
  if (model.inputCost === 0 && model.outputCost === 0) {
    badges.push({
      icon: DollarSign,
      label: 'FREE',
      className: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-950 dark:text-green-300 dark:ring-green-300/20'
    })
  }

  // New models (check tags)
  if (model.tags.includes('latest') || model.tags.includes('new')) {
    badges.push({
      icon: Sparkles,
      label: 'New',
      className: 'bg-pink-50 text-pink-700 ring-pink-600/20 dark:bg-pink-950 dark:text-pink-300 dark:ring-pink-300/20'
    })
  }

  // Best coding
  if (model.tags.includes('best-coding')) {
    badges.push({
      icon: Code,
      label: 'Best Coding',
      className: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-300/20'
    })
  }

  if (badges.length === 0) return null

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {badges.map((badge, index) => {
        const Icon = badge.icon
        return (
          <span
            key={index}
            className={cn(
              'inline-flex items-center rounded-md font-medium ring-1 ring-inset',
              badge.className,
              sizeClasses
            )}
          >
            <Icon className="w-3 h-3 mr-1" />
            {badge.label}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Tag badges for additional model properties
 */
interface TagBadgesProps {
  tags: string[]
  className?: string
  limit?: number
}

export function TagBadges({ tags, className, limit = 3 }: TagBadgesProps) {
  const displayTags = tags.slice(0, limit)
  const remaining = tags.length - limit

  if (displayTags.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {displayTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-300/10"
        >
          {tag}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-300/10">
          +{remaining}
        </span>
      )}
    </div>
  )
}
