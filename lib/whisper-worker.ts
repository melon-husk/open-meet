import {
  AutomaticSpeechRecognitionPipeline,
  pipeline,
  env,
} from "@huggingface/transformers";

const DEFAULT_MODEL_ID = "onnx-community/whisper-tiny";
const CHUNK_LENGTH_S = 30;
const STRIDE_LENGTH_S = 5;

env.allowLocalModels = false;

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
            decoder_model_merged: device === "webgpu" ? "fp32" : "q8",
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (transcriber as any)(audio, {
        top_k: 0,
        do_sample: false,
        chunk_length_s: CHUNK_LENGTH_S,
        stride_length_s: STRIDE_LENGTH_S,
        return_timestamps: true,
        force_full_sequences: false,
        language: language || undefined,
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
