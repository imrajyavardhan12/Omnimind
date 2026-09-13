import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { LayoutContent } from '@/components/LayoutContent'

const inter = Inter({ subsets: ['latin'] })

/**
 * The whole app renders inside ClerkProvider (see providers.tsx) and every
 * meaningful page requires a session (see middleware.ts). Prerendering any
 * page at build time would execute Clerk without a publishable key and crash
 * `next build` for fresh clones, CI, and keyless preview environments — so
 * all routes are dynamic by default. Runtime auth behavior is unchanged:
 * middleware still protects private routes and redirects anonymous users.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'OmniMind - Multi-LLM Comparison',
  description: 'Compare multiple LLM responses side-by-side',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/logos/icons8-mind-100.png',
    apple: '/logos/icons8-mind-100.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full overflow-x-hidden overflow-y-hidden" suppressHydrationWarning>
      <body className={`${inter.className} h-full overflow-x-hidden overflow-y-hidden`}>
        <Providers>
          <LayoutContent>{children}</LayoutContent>
        </Providers>
      </body>
    </html>
  )
}
