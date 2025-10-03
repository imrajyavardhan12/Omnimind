import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { LayoutContent } from '@/components/LayoutContent'

const inter = Inter({ subsets: ['latin'] })

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
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  )
}
