import { ChatSession, Message } from '@/lib/types'

export interface ExportOptions {
  format: 'json' | 'markdown' | 'csv'
  includeStats: boolean
  includeMetadata: boolean
}

export function exportSession(session: ChatSession, options: ExportOptions): string {
  switch (options.format) {
    case 'json':
      return exportAsJSON(session, options)
    case 'markdown':
      return exportAsMarkdown(session, options)
    case 'csv':
      return exportAsCSV(session, options)
    default:
      throw new Error(`Unsupported export format: ${options.format}`)
  }
}

function exportAsJSON(session: ChatSession, options: ExportOptions): string {
  const data = {
    session: {
      id: session.id,
      title: session.title,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.updatedAt).toISOString(),
      ...(options.includeMetadata && {
        activeProviders: session.activeProviders,
        messageCount: session.messages.length
      })
    },
    messages: session.messages.map(message => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.timestamp).toISOString(),
      ...(options.includeStats && {
        provider: message.provider,
        model: message.model,
        tokens: message.tokens,
        cost: message.cost
      })
    })),
    ...(options.includeStats && {
      stats: calculateSessionStats(session)
    })
  }

  return JSON.stringify(data, null, 2)
}

function exportAsMarkdown(session: ChatSession, options: ExportOptions): string {
  let markdown = `# ${session.title}\n\n`
  
  if (options.includeMetadata) {
    markdown += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`
    markdown += `**Updated:** ${new Date(session.updatedAt).toLocaleString()}\n`
    markdown += `**Providers:** ${session.activeProviders.join(', ')}\n\n`
  }

  if (options.includeStats) {
    const stats = calculateSessionStats(session)
    markdown += `## Session Statistics\n\n`
    markdown += `- **Total Messages:** ${stats.totalMessages}\n`
    markdown += `- **Total Tokens:** ${stats.totalTokens}\n`
    markdown += `- **Total Cost:** $${stats.totalCost.toFixed(4)}\n\n`
    
    if (Object.keys(stats.byProvider).length > 1) {
      markdown += `### By Provider\n\n`
      Object.entries(stats.byProvider).forEach(([provider, providerStats]) => {
        markdown += `**${provider.charAt(0).toUpperCase() + provider.slice(1)}:**\n`
        markdown += `- Messages: ${providerStats.messages}\n`
        markdown += `- Tokens: ${providerStats.tokens}\n`
        markdown += `- Cost: $${providerStats.cost.toFixed(4)}\n\n`
      })
    }
  }

  markdown += `## Conversation\n\n`

  session.messages.forEach((message, index) => {
    const role = message.role === 'user' ? '👤 **User**' : `🤖 **${message.provider || 'Assistant'}**`
    markdown += `### ${role}\n\n`
    markdown += `${message.content}\n\n`
    
    if (options.includeStats && message.provider) {
      markdown += `*Model: ${message.model || 'Unknown'} | Tokens: ${message.tokens || 'N/A'} | Cost: $${(message.cost || 0).toFixed(4)}*\n\n`
    }
    
    markdown += `---\n\n`
  })

  return markdown
}

function exportAsCSV(session: ChatSession, options: ExportOptions): string {
  const headers = [
    'Timestamp',
    'Role',
    'Content',
    ...(options.includeStats ? ['Provider', 'Model', 'Tokens', 'Cost'] : [])
  ]

  const rows = session.messages.map(message => {
    const row = [
      new Date(message.timestamp).toISOString(),
      message.role,
      `"${message.content.replace(/"/g, '""')}"` // Escape quotes in CSV
    ]

    if (options.includeStats) {
      row.push(
        message.provider || '',
        message.model || '',
        (message.tokens || '').toString(),
        (message.cost || '').toString()
      )
    }

    return row
  })

  const csvContent = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n')

  return csvContent
}

function calculateSessionStats(session: ChatSession) {
  return session.messages.reduce(
    (acc, message) => {
      if (message.role === 'assistant' && message.provider) {
        acc.totalMessages++
        acc.totalTokens += message.tokens || 0
        acc.totalCost += message.cost || 0
        
        const provider = message.provider
        if (!acc.byProvider[provider]) {
          acc.byProvider[provider] = { messages: 0, tokens: 0, cost: 0 }
        }
        acc.byProvider[provider].messages++
        acc.byProvider[provider].tokens += message.tokens || 0
        acc.byProvider[provider].cost += message.cost || 0
      }
      return acc
    },
    {
      totalMessages: 0,
      totalTokens: 0,
      totalCost: 0,
      byProvider: {} as Record<string, { messages: number; tokens: number; cost: number }>
    }
  )
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

export function generateFilename(session: ChatSession, format: string): string {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const title = session.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
  return `${title}_${date}.${format}`
}