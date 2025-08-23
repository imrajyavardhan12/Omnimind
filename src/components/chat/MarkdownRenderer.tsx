'use client'

import { memo, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import { cn } from '@/lib/utils'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

// Import Prism CSS theme
import 'prismjs/themes/prism-tomorrow.css'

interface MarkdownRendererProps {
  content: string
  className?: string
}

interface CodeBlockProps {
  className?: string
  children: React.ReactNode
}

const CodeBlock = ({ className, children }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false)
  
  // Extract language from className (e.g., "language-javascript" -> "javascript")
  const language = className?.replace('language-', '') || ''
  
  const copyToClipboard = async () => {
    if (typeof children === 'string') {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="relative group">
      <div className="flex items-center justify-between bg-muted/50 px-4 py-2 rounded-t-lg border-b">
        <span className="text-xs text-muted-foreground font-mono">
          {language || 'code'}
        </span>
        <button
          onClick={copyToClipboard}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
          title="Copy code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <pre className={cn(
        "overflow-x-auto rounded-t-none rounded-b-lg bg-[#2d2d2d] p-4",
        className
      )}>
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

export const MarkdownRenderer = memo(({ content, className }: MarkdownRendererProps) => {
  useEffect(() => {
    // Dynamically import highlight.js to avoid SSR issues
    if (typeof window !== 'undefined') {
      import('highlight.js/lib/common').then((hljs) => {
        hljs.default.highlightAll()
      }).catch(() => {
        // Fallback if highlight.js fails to load
        console.warn('Failed to load highlight.js')
      })
    }
  }, [content])

  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          // Custom heading styles
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-foreground mb-3 mt-6">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-foreground mb-2 mt-5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-foreground mb-2 mt-4">
              {children}
            </h4>
          ),
          
          // Custom paragraph styles
          p: ({ children }) => (
            <p className="text-foreground mb-4 leading-relaxed">
              {children}
            </p>
          ),

          // Custom list styles
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-foreground mb-4 space-y-1 ml-4">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-foreground mb-4 space-y-1 ml-4">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-foreground">
              {children}
            </li>
          ),

          // Custom link styles
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {children}
            </a>
          ),

          // Custom blockquote styles
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 bg-muted/50 pl-4 py-2 my-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),

          // Custom table styles
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border-collapse border border-border">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted px-4 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-4 py-2">
              {children}
            </td>
          ),

          // Custom inline code styles
          code: ({ className, children, ...props }: any) => {
            const isInline = !className || !className.startsWith('language-')
            
            if (isInline) {
              return (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            
            return <CodeBlock className={className}>{children}</CodeBlock>
          },

          // Custom pre styles (handled by CodeBlock)
          pre: ({ children }) => <>{children}</>,

          // Custom horizontal rule
          hr: () => (
            <hr className="my-6 border-t border-border" />
          ),

          // Custom strong/bold styles
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),

          // Custom emphasis/italic styles
          em: ({ children }) => (
            <em className="italic text-foreground">
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

MarkdownRenderer.displayName = 'MarkdownRenderer'