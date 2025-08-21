import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OmniMind - Multi-LLM Comparison',
  description: 'Compare multiple LLM responses side-by-side',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <header className="border-b border-border px-6 py-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">OmniMind</h1>
              <p className="text-sm text-muted-foreground">Multi-LLM Comparison Tool</p>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}