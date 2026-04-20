// Chrome built-in AI — Summarizer API (default) + Prompt API (feature flag)
//
// Set USE_PROMPT_API = true to switch to the Prompt API (window.ai.languageModel)
// which gives full prompt control but requires chrome://flags/#optimization-guide-on-device-model
const USE_PROMPT_API = false;

// ---------------------------------------------------------------------------
// Summarizer API types
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */

interface AISummarizerCapabilities {
  available: "readily" | "after-download" | "no";
}

interface AISummarizer {
  summarize(text: string, opts?: { context?: string }): Promise<string>;
  destroy(): void;
}

interface AISummarizerFactory {
  capabilities(): Promise<AISummarizerCapabilities>;
  create(opts?: Record<string, unknown>): Promise<AISummarizer>;
}

function getSummarizerAPI(): AISummarizerFactory | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.ai?.summarizer ?? null;
}

// ---------------------------------------------------------------------------
// Prompt API types (behind feature flag)
// ---------------------------------------------------------------------------

interface AILanguageModel {
  prompt(input: string): Promise<string>;
  destroy(): void;
}

interface AICapabilities {
  available: "readily" | "after-download" | "no";
}

interface AILM {
  capabilities(): Promise<AICapabilities>;
  create(opts?: Record<string, unknown>): Promise<AILanguageModel>;
}

function getPromptAPI(): AILM | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.ai?.languageModel ?? null;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function checkAISupport(): Promise<
  "readily" | "after-download" | "no"
> {
  try {
    if (USE_PROMPT_API) {
      const ai = getPromptAPI();
      if (!ai) return "no";
      return (await ai.capabilities()).available;
    }
    const api = getSummarizerAPI();
    if (!api) return "no";
    return (await api.capabilities()).available;
  } catch {
    return "no";
  }
}

export async function summarizeMeeting(
  transcript: string,
  notes: string
): Promise<string> {
  if (USE_PROMPT_API) {
    return summarizeWithPromptAPI(transcript, notes);
  }
  return summarizeWithSummarizerAPI(transcript, notes);
}

export async function chatWithSummary(
  summary: string,
  transcript: string,
  question: string
): Promise<string> {
  if (USE_PROMPT_API) {
    return chatWithPromptAPI(summary, transcript, question);
  }
  // Summarizer API can't do chat — fall back to Prompt API if available,
  // otherwise construct a summary-based answer
  const promptAI = getPromptAPI();
  if (promptAI) {
    return chatWithPromptAPI(summary, transcript, question);
  }
  throw new Error(
    "Chat requires the Prompt API. Enable it by setting USE_PROMPT_API = true."
  );
}

// ---------------------------------------------------------------------------
// Summarizer API implementation
// ---------------------------------------------------------------------------

async function summarizeWithSummarizerAPI(
  transcript: string,
  notes: string
): Promise<string> {
  const api = getSummarizerAPI();
  if (!api) throw new Error("Summarizer API not available");

  const caps = await api.capabilities();
  if (caps.available === "no") throw new Error("Summarizer not available");

  const summarizer = await api.create({
    type: "key-points",
    format: "markdown",
    length: "medium",
    sharedContext:
      "This is a meeting transcript, often in Hinglish (Hindi + English mix). Summarize in English with key discussion points, decisions, and action items.",
  });

  try {
    const input = buildSummarizerInput(transcript, notes);
    return await summarizer.summarize(input, {
      context:
        "Produce the summary in English. Include key points, decisions made, and action items.",
    });
  } finally {
    summarizer.destroy();
  }
}

function buildSummarizerInput(transcript: string, notes: string): string {
  let input = transcript;
  if (notes.trim()) {
    input += `\n\nUser notes:\n${notes}`;
  }
  return input;
}

// ---------------------------------------------------------------------------
// Prompt API implementation (feature-flagged)
// ---------------------------------------------------------------------------

async function summarizeWithPromptAPI(
  transcript: string,
  notes: string
): Promise<string> {
  const ai = getPromptAPI();
  if (!ai) throw new Error("Prompt API not available");

  const caps = await ai.capabilities();
  if (caps.available === "no") throw new Error("AI model not available");

  const session = await ai.create({
    systemPrompt:
      "You are a meeting summarizer. You receive a meeting transcript (often in Hinglish — a mix of Hindi and English) and optional user notes. Produce a clear, structured English summary with: 1) Key discussion points 2) Decisions made 3) Action items. Be concise and professional. If user notes are provided, incorporate them as high-priority context.",
  });

  try {
    let prompt = `## Meeting Transcript\n${transcript}\n`;
    if (notes.trim()) {
      prompt += `\n## My Notes\n${notes}\n`;
    }
    prompt +=
      "\n## Instructions\nSummarize this meeting in English. Structure the summary with Key Points, Decisions, and Action Items.";
    return await session.prompt(prompt);
  } finally {
    session.destroy();
  }
}

async function chatWithPromptAPI(
  summary: string,
  transcript: string,
  question: string
): Promise<string> {
  const ai = getPromptAPI();
  if (!ai) throw new Error("Prompt API not available");

  const caps = await ai.capabilities();
  if (caps.available === "no") throw new Error("AI model not available");

  const session = await ai.create({
    systemPrompt:
      "You are a helpful assistant that answers questions about a meeting. You have the meeting summary and full transcript as context. Answer in English, be concise and specific. If the answer is not in the context, say so.",
  });

  try {
    const prompt = `## Meeting Summary\n${summary}\n\n## Full Transcript\n${transcript}\n\n## Question\n${question}`;
    return await session.prompt(prompt);
  } finally {
    session.destroy();
  }
}
