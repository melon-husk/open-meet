import { TranscriptSegment } from "./db";

type SpeechCb = (seg: TranscriptSegment) => void;
type ErrorCb = (error: string) => void;

export interface SpeechController {
  start: () => void;
  stop: () => void;
  isListening: () => boolean;
}

export function isSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    window.SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  );
}

export function createSpeechRecognizer(
  onSegment: SpeechCb,
  onError: ErrorCb
): SpeechController {
  const SR =
    window.SpeechRecognition ||
    (window as unknown as Record<string, unknown>)
      .webkitSpeechRecognition as typeof SpeechRecognition;

  const recognition = new SR();
  recognition.lang = "hi-IN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let intentionalStop = false;
  let listening = false;

  recognition.onresult = (e: SpeechRecognitionEvent) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      onSegment({
        text: result[0].transcript,
        timestamp: Date.now(),
        isFinal: result.isFinal,
      });
    }
  };

  recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
    if (e.error === "aborted" && intentionalStop) return;
    if (e.error === "no-speech") return; // normal during silence
    onError(e.error);
  };

  recognition.onend = () => {
    listening = false;
    // Auto-restart if not intentionally stopped
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
