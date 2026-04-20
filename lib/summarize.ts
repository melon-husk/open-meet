// Chrome built-in AI (Prompt API) for local summarization
// Uses LanguageModel / Summarizer when available

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

function getAI(): AILM | null {
  if (typeof window === "undefined") return null;
  // Chrome's Prompt API surface
  const w = window as unknown as Record<string, unknown>;
  const ai = w.ai as Record<string, unknown> | undefined;
  if (ai?.languageModel) return ai.languageModel as unknown as AILM;
  return null;
}

export async function checkAISupport(): Promise<
  "readily" | "after-download" | "no"
> {
  const ai = getAI();
  if (!ai) return "no";
  try {
    const caps = await ai.capabilities();
    return caps.available;
  } catch {
    return "no";
  }
}

export async function summarizeMeeting(
  transcript: string,
  notes: string
): Promise<string> {
  const ai = getAI();
  if (!ai) throw new Error("AI not available");

  const caps = await ai.capabilities();
  if (caps.available === "no") throw new Error("AI model not available");

  const session = await ai.create({
    systemPrompt:
      "You are a meeting summarizer. You receive a meeting transcript (often in Hinglish — a mix of Hindi and English) and optional user notes. Produce a clear, structured English summary with: 1) Key discussion points 2) Decisions made 3) Action items. Be concise and professional. If user notes are provided, incorporate them as high-priority context.",
  });

  try {
    const prompt = buildPrompt(transcript, notes);
    return await session.prompt(prompt);
  } finally {
    session.destroy();
  }
}

function buildPrompt(transcript: string, notes: string): string {
  let prompt = `## Meeting Transcript\n${transcript}\n`;
  if (notes.trim()) {
    prompt += `\n## My Notes\n${notes}\n`;
  }
  prompt += `\n## Instructions\nSummarize this meeting in English. Structure the summary with Key Points, Decisions, and Action Items.`;
  return prompt;
}

export async function chatWithSummary(
  summary: string,
  transcript: string,
  question: string
): Promise<string> {
  const ai = getAI();
  if (!ai) throw new Error("AI not available");

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
