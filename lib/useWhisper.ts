"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getAudioChunks } from "@/lib/db";

export type WhisperDevice = "webgpu" | "wasm";

export interface WhisperProgress {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export interface WhisperChunk {
  text: string;
  timestamp: [number, number | null];
}

export interface WhisperResult {
  text: string;
  chunks: WhisperChunk[];
}

async function detectWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/** Decode audio blobs to a 16kHz mono Float32Array for Whisper. */
async function decodeBlobsToFloat32(blobs: Blob[]): Promise<Float32Array> {
  const merged = new Blob(blobs, { type: blobs[0]?.type || "audio/webm" });
  const arrayBuffer = await merged.arrayBuffer();
  // Decode at 16kHz — Whisper's native sample rate
  const audioCtx = new OfflineAudioContext(1, 1, 16000);
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  // Extract mono channel
  return decoded.getChannelData(0);
}

export function useWhisper() {
  const workerRef = useRef<Worker | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState<WhisperProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null);

  const resolveRef = useRef<((result: WhisperResult) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);
  const readyResolveRef = useRef<(() => void) | null>(null);
  const readyRejectRef = useRef<((err: Error) => void) | null>(null);

  useEffect(() => {
    detectWebGPU().then(setWebgpuAvailable);
  }, []);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("./whisper-worker.ts", import.meta.url),
        { type: "module" }
      );
      workerRef.current.addEventListener("message", (e: MessageEvent) => {
        const { type, data } = e.data;

        if (type === "initiate" || type === "progress" || type === "done") {
          setProgress((prev) => [...prev, data as WhisperProgress]);
        } else if (type === "ready") {
          setModelLoaded(true);
          setLoading(false);
          readyResolveRef.current?.();
          readyResolveRef.current = null;
        } else if (type === "complete") {
          setTranscribing(false);
          resolveRef.current?.(data as WhisperResult);
          resolveRef.current = null;
          rejectRef.current = null;
        } else if (type === "error") {
          const msg = (data as { message: string }).message;
          setError(msg);
          setLoading(false);
          setTranscribing(false);
          readyRejectRef.current?.(new Error(msg));
          readyResolveRef.current = null;
          readyRejectRef.current = null;
          rejectRef.current?.(new Error(msg));
          resolveRef.current = null;
          rejectRef.current = null;
        }
      });
    }
    return workerRef.current;
  }, []);

  const loadModel = useCallback(
    (device: WhisperDevice): Promise<void> => {
      setLoading(true);
      setError(null);
      setProgress([]);
      return new Promise<void>((resolve, reject) => {
        readyResolveRef.current = resolve;
        readyRejectRef.current = reject;
        getWorker().postMessage({ type: "load", device });
      });
    },
    [getWorker]
  );

  const transcribe = useCallback(
    async (meetingId: string, language?: string): Promise<WhisperResult> => {
      setError(null);
      setTranscribing(true);

      const blobs = await getAudioChunks(meetingId);
      if (blobs.length === 0) {
        setTranscribing(false);
        throw new Error("No audio chunks found for this meeting");
      }

      const audio = await decodeBlobsToFloat32(blobs);

      return new Promise<WhisperResult>((resolve, reject) => {
        resolveRef.current = resolve;
        rejectRef.current = reject;
        getWorker().postMessage({ type: "transcribe", audio, language });
      });
    },
    [getWorker]
  );

  const destroy = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setModelLoaded(false);
  }, []);

  return {
    loadModel,
    transcribe,
    destroy,
    modelLoaded,
    loading,
    transcribing,
    progress,
    error,
    webgpuAvailable,
  };
}
