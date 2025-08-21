# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Multi-LLM Comparison Application

## Overview
Open-source web app for comparing multiple LLM responses side-by-side. Users provide their own API keys for each service.

## Core Features
- Side-by-side LLM response comparison (2-4 panels)
- Support for OpenAI, Anthropic, Google, Cohere, Mistral
- Real-time streaming responses
- Client-side API key storage (encrypted)
- Token counting & cost estimation
- Export/share conversations

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Components**: Shadcn/ui
- **State**: Zustand (settings), React Query (API calls)
- **Validation**: Zod
- **Deployment**: Vercel

## Architecture Principles

### Security
- API keys stored client-side only (localStorage with encryption)
- Keys transmitted via secure headers, never in request body
- No server-side key storage or logging
- Rate limiting on API routes

### Performance
- Streaming responses for better UX
- Debounced input handling
- Lazy loading for provider modules
- Optimistic UI updates

### Error Handling
- Provider-specific error mapping
- Graceful fallbacks for API failures
- User-friendly error messages
- Retry logic with exponential backoff

## Project Structure
```
/app
  /api/chat         # Proxy endpoint for CORS
  layout.tsx        # Root layout with providers
  page.tsx          # Main comparison interface
/components
  /chat             # ChatPanel, MessageList, Input
  /settings         # APIKeyManager, ModelSelector
  /ui               # Shadcn components
/lib
  /providers        # LLM provider implementations
  /stores           # Zustand stores
  /utils            # Encryption, errors, constants
/hooks              # Custom React hooks
```

## Key Implementation Details

### Provider Interface
Each LLM provider implements:
- `stream()` - For streaming responses
- `complete()` - For non-streaming
- `models[]` - Available models
- `validateAPIKey()` - Key validation

### State Management
- **Settings Store**: API keys, selected models, parameters
- **Chat Store**: Conversation history, active chats
- **UI Store**: Panel layout, theme, preferences

### API Design
Single `/api/chat` endpoint that:
1. Validates request schema
2. Checks rate limits
3. Forwards to appropriate provider
4. Handles streaming/non-streaming
5. Returns normalized responses

### Testing Strategy
- Unit tests for providers and utilities
- Integration tests for API routes
- E2E tests for critical user flows
- Snapshot tests for UI components

## Development Commands

When the project is set up, use these commands:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run type-check

# Run all checks before committing
npm run validate
```

## Development Workflow

### Phase 1: Foundation (Week 1)
- Project setup with Next.js and TypeScript
- Basic UI layout with responsive grid
- Settings management with Zustand
- OpenAI provider implementation

### Phase 2: Multi-Provider (Week 2)
- Add Anthropic, Google, Cohere providers
- Unified provider interface
- Streaming response handling
- Error boundaries and fallbacks

### Phase 3: Features (Week 3)
- Token counting and cost calculation
- Export functionality
- Conversation history
- Model parameter controls

### Phase 4: Polish (Week 4)
- Performance optimization
- Comprehensive error handling
- Documentation and examples
- CI/CD pipeline setup

## Production Considerations

### Monitoring
- Error tracking (Sentry)
- Analytics for usage patterns
- Performance monitoring
- API usage dashboards

### Scalability
- Edge functions for API routes
- CDN for static assets
- Efficient state management
- Request batching where possible

### Documentation
- README with quick start guide
- API documentation
- Contributing guidelines
- Security best practices

## Environment Variables
```env
NEXT_PUBLIC_APP_URL=
ENCRYPTION_KEY=
RATE_LIMIT_ENABLED=true
```

## License
MIT License - fully open source