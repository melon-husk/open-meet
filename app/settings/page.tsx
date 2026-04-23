"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getSetting,
  saveSetting,
  getMeetingCount,
  getAudioStorageEstimate,
  deleteAllAudio,
  clearWhisperCache,
} from "@/lib/db";
import { LANGUAGES, DEFAULT_LANG } from "@/components/LanguageSelector";

type WhisperDevice = "wasm" | "webgpu";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function SettingsPage() {
  // Recording defaults
  const [lang, setLang] = useState(DEFAULT_LANG);
  const [whisperDevice, setWhisperDevice] = useState<WhisperDevice>("wasm");
  const [webgpuAvailable, setWebgpuAvailable] = useState(false);

  // Storage stats
  const [meetingCount, setMeetingCount] = useState<number | null>(null);
  const [audioStats, setAudioStats] = useState<{ count: number; bytes: number } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearingModel, setClearingModel] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadStats = useCallback(async () => {
    const [count, audio] = await Promise.all([
      getMeetingCount(),
      getAudioStorageEstimate(),
    ]);
    setMeetingCount(count);
    setAudioStats(audio);
  }, []);

  useEffect(() => {
    // Load saved settings
    Promise.all([
      getSetting("selectedLanguage"),
      getSetting("whisperDevice"),
    ]).then(([savedLang, savedDevice]) => {
      if (savedLang) setLang(savedLang);
      if (savedDevice === "wasm" || savedDevice === "webgpu") setWhisperDevice(savedDevice);
    });

    // Detect WebGPU
    if ("gpu" in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).gpu.requestAdapter().then((adapter: unknown) => {
        setWebgpuAvailable(adapter !== null);
      }).catch(() => {});
    }

    loadStats();
  }, [loadStats]);

  async function handleSaveLang(value: string) {
    setLang(value);
    await saveSetting("selectedLanguage", value);
    flashSaved();
  }

  async function handleSaveWhisperDevice(value: WhisperDevice) {
    setWhisperDevice(value);
    await saveSetting("whisperDevice", value);
    flashSaved();
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleClearAudio() {
    if (!confirm("Delete all recorded audio? Transcripts and notes will be kept.")) return;
    setClearing(true);
    await deleteAllAudio();
    await loadStats();
    setClearing(false);
  }

  async function handleClearModel() {
    if (!confirm("Remove the cached Whisper model? It will be re-downloaded on next use.")) return;
    setClearingModel(true);
    await clearWhisperCache();
    setClearingModel(false);
  }

  return (
    <div className="flex flex-col flex-1 items-center">
      <div className="w-full max-w-2xl flex flex-col flex-1 px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="text-base font-semibold text-zinc-900 tracking-tight"
          >
            Open Meet
          </Link>
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            ← Back
          </Link>
        </header>

        <h1 className="text-xl font-semibold text-zinc-900 mb-6">Settings</h1>

        {saved && (
          <div className="mb-4 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg w-fit">
            Saved
          </div>
        )}

        <div className="space-y-8">
          {/* Recording Defaults */}
          <section>
            <h2 className="text-sm font-medium text-zinc-900 mb-3">Recording Defaults</h2>
            <div className="space-y-4 bg-zinc-50/50 rounded-lg p-4 border border-zinc-100">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-700">Default Language</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Used for speech recognition and Whisper</p>
                </div>
                <select
                  value={lang}
                  onChange={(e) => handleSaveLang(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white text-zinc-600"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Whisper */}
          <section>
            <h2 className="text-sm font-medium text-zinc-900 mb-3">Whisper Transcription</h2>
            <div className="space-y-4 bg-zinc-50/50 rounded-lg p-4 border border-zinc-100">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-700">Backend</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    WebGPU is faster but requires compatible hardware
                  </p>
                </div>
                <select
                  value={whisperDevice}
                  onChange={(e) => handleSaveWhisperDevice(e.target.value as WhisperDevice)}
                  className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white text-zinc-600"
                >
                  <option value="wasm">WASM (Universal)</option>
                  {webgpuAvailable && <option value="webgpu">WebGPU (Faster)</option>}
                </select>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-700">Model</p>
                  <p className="text-xs text-zinc-400 mt-0.5">onnx-community/whisper-tiny · ~39 MB</p>
                </div>
                <button
                  onClick={handleClearModel}
                  disabled={clearingModel}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  {clearingModel ? "Clearing…" : "Clear Cached Model"}
                </button>
              </div>
            </div>
          </section>

          {/* Storage */}
          <section>
            <h2 className="text-sm font-medium text-zinc-900 mb-3">Storage</h2>
            <div className="space-y-4 bg-zinc-50/50 rounded-lg p-4 border border-zinc-100">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-semibold text-zinc-900">
                    {meetingCount ?? "–"}
                  </p>
                  <p className="text-xs text-zinc-400">Meetings</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-zinc-900">
                    {audioStats ? formatBytes(audioStats.bytes) : "–"}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Audio ({audioStats?.count ?? 0} chunks)
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100">
                <button
                  onClick={handleClearAudio}
                  disabled={clearing || (audioStats?.count ?? 0) === 0}
                  className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {clearing ? "Deleting…" : "Delete All Audio"}
                </button>
                <p className="text-[10px] text-zinc-400 mt-1.5">
                  Removes recorded audio. Transcripts and notes are kept.
                </p>
              </div>
            </div>
          </section>

          {/* About */}
          <section>
            <h2 className="text-sm font-medium text-zinc-900 mb-3">About</h2>
            <div className="bg-zinc-50/50 rounded-lg p-4 border border-zinc-100">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Open Meet runs entirely in your browser. No audio, transcripts, or
                notes ever leave your device. Speech recognition uses the Web Speech
                API. Whisper retranscription uses transformers.js with local ONNX
                models. Summaries use Chrome&apos;s built-in Gemini Nano.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-zinc-100">
          <p className="text-[10px] text-zinc-500 text-center">
            Everything runs locally in your browser · No data leaves your device
          </p>
        </footer>
      </div>
    </div>
  );
}
