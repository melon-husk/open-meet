import {
  AutomaticSpeechRecognitionPipeline,
  pipeline,
  env,
} from "@huggingface/transformers";

const DEFAULT_MODEL_ID = "onnx-community/whisper-tiny";
const CHUNK_LENGTH_S = 30;
const STRIDE_LENGTH_S = 5;

env.allowLocalModels = false;

// Use all available cores for WASM backend (requires COEP/COOP headers)
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;
}

/** Map BCP-47 language codes (e.g. "hi-IN") to Whisper language names. */
const BCP47_TO_WHISPER: Record<string, string> = {
  hi: "hindi",
  en: "english",
  ta: "tamil",
  te: "telugu",
  kn: "kannada",
  mr: "marathi",
  bn: "bengali",
  es: "spanish",
  fr: "french",
  de: "german",
  zh: "chinese",
  ja: "japanese",
  ko: "korean",
  pt: "portuguese",
  ru: "russian",
  ar: "arabic",
  it: "italian",
  nl: "dutch",
  pl: "polish",
  tr: "turkish",
  sv: "swedish",
  da: "danish",
  fi: "finnish",
  no: "norwegian",
  uk: "ukrainian",
  el: "greek",
  he: "hebrew",
  th: "thai",
  vi: "vietnamese",
  id: "indonesian",
  ms: "malay",
  ro: "romanian",
  hu: "hungarian",
  cs: "czech",
  sk: "slovak",
  bg: "bulgarian",
  hr: "croatian",
  sr: "serbian",
  sl: "slovenian",
  lt: "lithuanian",
  lv: "latvian",
  et: "estonian",
  ml: "malayalam",
  gu: "gujarati",
  pa: "punjabi",
  ur: "urdu",
  fa: "persian",
  sw: "swahili",
  tl: "tagalog",
  la: "latin",
};

function resolveWhisperLanguage(lang?: string): string | undefined {
  if (!lang) return undefined;
  const lower = lang.toLowerCase();
  // Try exact match first (e.g. "hindi"), then BCP-47 prefix (e.g. "hi" from "hi-IN")
  if (Object.values(BCP47_TO_WHISPER).includes(lower)) return lower;
  const prefix = lower.split("-")[0];
  return BCP47_TO_WHISPER[prefix];
}

class WhisperPipeline {
  static instance: AutomaticSpeechRecognitionPipeline | null = null;
  static currentDevice: string | null = null;

  static async getInstance(
    device: "webgpu" | "wasm",
    progressCallback?: (data: unknown) => void
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    if (this.instance !== null && this.currentDevice !== device) {
      this.instance = null;
      this.currentDevice = null;
    }
    if (this.instance === null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.instance = (await (pipeline as any)(
        "automatic-speech-recognition",
        DEFAULT_MODEL_ID,
        {
          device,
          dtype: {
            encoder_model: "fp32",
            decoder_model_merged: "fp32",
          },
          progress_callback: progressCallback,
        }
      )) as AutomaticSpeechRecognitionPipeline;
      this.currentDevice = device;
    }
    return this.instance;
  }
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const { device } = event.data as { device: "webgpu" | "wasm" };
    try {
      await WhisperPipeline.getInstance(device, (data: unknown) => {
        const d = data as Record<string, unknown>;
        self.postMessage({ type: d.status, data: d });
      });
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to load Whisper model",
        },
      });
    }
  }

  if (type === "transcribe") {
    const { audio, language } = event.data as {
      audio: Float32Array;
      language?: string;
    };
    try {
      const transcriber = await WhisperPipeline.getInstance("wasm");

      // Calculate total chunks for progress reporting
      const durationS = audio.length / 16000;
      const effectiveStride = CHUNK_LENGTH_S - STRIDE_LENGTH_S;
      const totalChunks = Math.max(1, Math.ceil(durationS / effectiveStride));
      let currentChunk = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (transcriber as any)(audio, {
        top_k: 0,
        do_sample: false,
        chunk_length_s: CHUNK_LENGTH_S,
        stride_length_s: STRIDE_LENGTH_S,
        return_timestamps: true,
        force_full_sequences: false,
        language: resolveWhisperLanguage(language),
        chunk_callback: () => {
          currentChunk++;
          self.postMessage({
            type: "transcribe_progress",
            data: { current: currentChunk, total: totalChunks },
          });
        },
      });

      const output = result as {
        text: string;
        chunks?: Array<{
          text: string;
          timestamp: [number, number | null];
        }>;
      };

      self.postMessage({
        type: "complete",
        data: {
          text: output.text || "",
          chunks:
            output.chunks || [{ text: output.text || "", timestamp: [0, null] }],
        },
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Transcription failed",
        },
      });
    }
  }
});
