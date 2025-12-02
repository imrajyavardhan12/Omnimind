'use client'

import dynamic from 'next/dynamic'
import { ComponentProps } from 'react'

// Lazy load shader components to reduce initial bundle size
// These are heavy WebGL components that block the main thread

export const LazyLiquidMetal = dynamic(
  () => import('@paper-design/shaders-react').then((mod) => mod.LiquidMetal),
  { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-full" />
  }
)

export const LazyPulsingBorder = dynamic(
  () => import('@paper-design/shaders-react').then((mod) => mod.PulsingBorder),
  { 
    ssr: false,
    loading: () => null
  }
)

// Re-export types for convenience
export type LiquidMetalProps = ComponentProps<typeof LazyLiquidMetal>
export type PulsingBorderProps = ComponentProps<typeof LazyPulsingBorder>
