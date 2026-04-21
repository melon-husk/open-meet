# Open Meet

A privacy-first meeting transcription and summarization app that runs entirely in your browser. No data ever leaves your device.

## Features

- **Live Transcription** — Real-time speech-to-text using the Web Speech API
- **AI Summaries** — Generate structured summaries (key points, decisions, action items) with Chrome's built-in Summarizer API
- **Meeting Chat** — Ask questions about any recorded meeting using the Prompt API
- **Notes** — Take notes alongside the transcript; edit later and regenerate summaries
- **Pause / Resume** — Pause and resume recording as needed, with autosave every 10 seconds
- **Offline Storage** — All meetings stored locally in IndexedDB

## Tech Stack

- [Next.js](https://nextjs.org) 16 + React 19
- [Tailwind CSS](https://tailwindcss.com) 4
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) for transcription
- [Chrome Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api) for AI summaries
- [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api) for meeting chat (feature-flagged)
- IndexedDB for local persistence

## Prerequisites

- **Chrome or Edge** (required for Speech Recognition and Chrome AI APIs)
- **Gemini Nano** enabled — go to `chrome://flags/#optimization-guide-on-device-model` and set to **Enabled**
- **Summarizer API** enabled — go to `chrome://flags/#summarization-api-for-gemini-nano` and set to **Enabled**
- Node.js 18+

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome.

## How It Works

1. **Record** — Start a new meeting, speak, and the transcript appears in real time
2. **Note** — Add notes in the side panel during or after the meeting
3. **Summarize** — Generate an AI summary from the transcript and your notes
4. **Chat** — Ask follow-up questions about the meeting content
5. **Review** — Browse past meetings from the home page

## Privacy

Everything runs client-side. Speech recognition, AI summarization, and storage all happen in your browser. No server, no third-party APIs, no data exfiltration.
