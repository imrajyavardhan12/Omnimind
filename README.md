# OmniMind

A web app for comparing responses from multiple AI models side by side. Chat with OpenAI, Anthropic, Google Gemini, and OpenRouter models simultaneously to see how they differ.

## Features

- Compare multiple AI models in real-time
- Side-by-side chat panels
- Token counting and cost estimation
- Dark mode (default)
- Export conversations
- File attachments support

## Setup

1. Clone the repository
2. Install dependencies: `bun install`
3. Start development server: `bun run dev`
4. Open http://localhost:3000

## Configuration

Add your API keys in the Settings panel:
- OpenAI API key
- Anthropic API key  
- Google Gemini API key
- OpenRouter API key

Keys are stored locally in your browser only.

## Build for Production

```bash
bun run build
bun start
```

## Tech Stack

- Next.js 14
- Bun runtime
- TypeScript
- Tailwind CSS
- Zustand for state management

## License

MIT