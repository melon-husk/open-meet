import { useEffect, useState } from "react";
import { getSetting, saveSetting } from "@/lib/db";

export type TranscriptionEngine = "speech-api" | "whisper-wasm" | "whisper-webgpu";

interface Props {
  disabled?: boolean;
  onEngineChange: (engine: TranscriptionEngine) => void;
}

export default function TranscriptionEngineSelector({ disabled, onEngineChange }: Props) {
  const [engine, setEngine] = useState<TranscriptionEngine>("speech-api");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSetting("transcription_engine").then((val) => {
      if (val === "whisper-wasm" || val === "whisper-webgpu" || val === "speech-api") {
        setEngine(val);
        onEngineChange(val);
      } else {
        onEngineChange("speech-api");
      }
      setLoading(false);
    });
  }, [onEngineChange]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEngine = e.target.value as TranscriptionEngine;
    setEngine(newEngine);
    saveSetting("transcription_engine", newEngine);
    onEngineChange(newEngine);
  };

  if (loading) {
    return <div className="h-9 w-32 bg-zinc-100 rounded-lg animate-pulse" />;
  }

  return (
    <div className="relative">
      <select
        disabled={disabled}
        value={engine}
        onChange={handleChange}
        className="appearance-none bg-white border border-zinc-200 text-zinc-700 text-sm rounded-lg pl-3 pr-8 py-2 outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed w-full min-w-[140px]"
      >
        <option value="speech-api">Built-in API</option>
        <option value="whisper-wasm">Whisper (WASM)</option>
        <option value="whisper-webgpu">Whisper (WebGPU)</option>
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
