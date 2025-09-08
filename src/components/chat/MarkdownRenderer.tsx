'use client'

import { memo, useEffect, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { cn } from '@/lib/utils'
import { Copy, Check } from 'lucide-react'

// Import Prism for syntax highlighting - only core for now
import Prism from 'prismjs'
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
  const codeContent = String(children).replace(/\n$/, '')
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(codeContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Language display mapping for better UX
  const languageDisplayMap: Record<string, string> = {
    'javascript': 'JavaScript',
    'typescript': 'TypeScript', 
    'jsx': 'React JSX',
    'tsx': 'React TSX',
    'python': 'Python',
    'java': 'Java',
    'c': 'C',
    'cpp': 'C++',
    'csharp': 'C#',
    'go': 'Go',
    'rust': 'Rust',
    'php': 'PHP',
    'ruby': 'Ruby',
    'swift': 'Swift',
    'kotlin': 'Kotlin',
    'sql': 'SQL',
    'json': 'JSON',
    'yaml': 'YAML',
    'markdown': 'Markdown',
    'bash': 'Bash',
    'shell': 'Shell',
    'css': 'CSS',
    'scss': 'SCSS'
  }

  const displayLanguage = languageDisplayMap[language.toLowerCase()] || language || 'Code'

  // Safe syntax highlighting function with dynamic loading
  const getHighlightedCode = useCallback(async () => {
    if (!language || typeof window === 'undefined') {
      return codeContent
    }

    try {
      const normalizedLanguage = language.toLowerCase()
      
      // Load the language component if it doesn't exist
      if (!Prism.languages[normalizedLanguage] && normalizedLanguage !== 'text' && normalizedLanguage !== 'plain') {
        try {
          // Dynamically import common languages
          switch (normalizedLanguage) {
            case 'javascript':
            case 'js':
              await import('prismjs/components/prism-javascript' as any)
              break
            case 'typescript':
            case 'ts':
              await import('prismjs/components/prism-typescript' as any)
              break
            case 'python':
            case 'py':
              await import('prismjs/components/prism-python' as any)
              break
            case 'jsx':
              await import('prismjs/components/prism-jsx' as any)
              break
            case 'tsx':
              await import('prismjs/components/prism-tsx' as any)
              break
            case 'json':
              await import('prismjs/components/prism-json' as any)
              break
            case 'css':
              await import('prismjs/components/prism-css' as any)
              break
            case 'bash':
            case 'shell':
              await import('prismjs/components/prism-bash' as any)
              break
            case 'yaml':
            case 'yml':
              await import('prismjs/components/prism-yaml' as any)
              break
          }
        } catch (importError) {
          console.warn(`Failed to load language component for ${normalizedLanguage}:`, importError)
        }
      }

      // Try to highlight with the loaded grammar
      const languageGrammar = Prism.languages[normalizedLanguage] || Prism.languages.javascript
      
      if (languageGrammar && Prism.highlight) {
        return Prism.highlight(codeContent, languageGrammar, normalizedLanguage)
      }
    } catch (error) {
      console.warn(`Failed to highlight ${language}:`, error)
    }

    // Fallback to plain text with basic escaping
    return codeContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }, [language, codeContent])

  // Use state to manage highlighted code
  const [highlightedCode, setHighlightedCode] = useState(codeContent)

  useEffect(() => {
    const highlight = async () => {
      const highlighted = await getHighlightedCode()
      setHighlightedCode(highlighted)
    }
    highlight()
  }, [language, codeContent, getHighlightedCode])

  return (
    <div className="relative group my-4">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between bg-zinc-800 px-4 py-3 rounded-t-lg border border-zinc-700">
        <span className="text-sm text-zinc-300 font-medium">
          {displayLanguage}
        </span>
        <button
          onClick={copyToClipboard}
          className="opacity-70 hover:opacity-100 transition-all duration-200 p-2 hover:bg-zinc-700 rounded-md text-zinc-300 hover:text-white flex items-center gap-2 text-sm"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      
      {/* Code content */}
      <div className="relative">
        <pre className={cn(
          "overflow-x-auto bg-zinc-900 p-4 rounded-t-none rounded-b-lg border border-t-0 border-zinc-700",
          "scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-800",
          className
        )}>
          <code 
            className={cn(
              className,
              "text-sm leading-relaxed block",
              "text-zinc-100 font-mono"
            )}
            dangerouslySetInnerHTML={{
              __html: highlightedCode
            }}
          />
        </pre>
      </div>
    </div>
  )
}

// Preprocess content to remove thinking tags and other unwanted elements
const preprocessContent = (content: string): string => {
  // Remove all variants of thinking tags more comprehensively
  let cleanedContent = content
    // Remove antml:thinking tags (most specific first)
    .replace(/<thinking[^>]*>[\s\S]*?<\/antml:thinking>/gi, '')
    // Remove thinking tags  
    .replace(/<thinking[^>]*>[\s\S]*?<\/thinking>/gi, '')
    // Remove think tags (both self-closing and paired)
    .replace(/<think[^>]*\/>/gi, '')
    .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '')
    // Remove any standalone think tags that might remain
    .replace(/<\/?think[^>]*>/gi, '')
    .replace(/<\/?thinking[^>]*>/gi, '')
    .replace(/<\/?antml:thinking[^>]*>/gi, '')
    // Extra cleanup - remove any remaining XML-style thinking tags
    .replace(/&lt;thinking[^&]*&gt;[\s\S]*?&lt;\/thinking&gt;/gi, '')
    .replace(/&lt;think[^&]*&gt;[\s\S]*?&lt;\/think&gt;/gi, '')
    .trim()
  
  // Log if we find any remaining think tags for debugging
  if (cleanedContent.match(/<\/?think[^>]*>/i) || cleanedContent.match(/think[^>]*>/i)) {
    console.warn('Remaining think tags detected:', cleanedContent.substring(0, 200))
  }
  
  return cleanedContent
}

export const MarkdownRenderer = memo(({ content, className }: MarkdownRendererProps) => {
  useEffect(() => {
    // Ensure Prism is ready for syntax highlighting
    if (typeof window !== 'undefined') {
      // Re-highlight any code blocks that might have been added dynamically
      Prism.highlightAll()
    }
  }, [content])

  // Preprocess content to remove unwanted tags
  const cleanedContent = preprocessContent(content)

  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
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
                  className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded-md text-sm font-mono border border-zinc-700"
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
        {cleanedContent}
      </ReactMarkdown>
    </div>
  )
})

MarkdownRenderer.displayName = 'MarkdownRenderer'