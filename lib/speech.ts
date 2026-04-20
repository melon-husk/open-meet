import { TranscriptSegment } from "./db";

type SpeechCb = (seg: TranscriptSegment) => void;
type ErrorCb = (error: string) => void;

export interface SpeechController {
  start: () => void;
  stop: () => void;
  isListening: () => boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function getSR(): (new () => any) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSupported(): boolean {
  return getSR() !== null;
}

export function createSpeechRecognizer(
  onSegment: SpeechCb,
  onError: ErrorCb
): SpeechController {
  const SR = getSR();
  if (!SR) throw new Error("Speech recognition not supported");

  const recognition = new SR();
  recognition.lang = "hi-IN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let intentionalStop = false;
  let listening = false;

  recognition.onresult = (e: any) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      onSegment({
        text: result[0].transcript,
        timestamp: Date.now(),
        isFinal: result.isFinal,
      });
    }
  };

  recognition.onerror = (e: any) => {
    if (e.error === "aborted" && intentionalStop) return;
    if (e.error === "no-speech") return;
    onError(e.error);
  };

  recognition.onend = () => {
    listening = false;
    if (!intentionalStop) {
      try {
        recognition.start();
        listening = true;
      } catch {
        // already started or mic lost
      }
    }
  };

  return {
    start() {
      intentionalStop = false;
      try {
        recognition.start();
        listening = true;
      } catch {
        // already running
      }
    },
    stop() {
      intentionalStop = true;
      recognition.stop();
      listening = false;
    },
    isListening: () => listening,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
