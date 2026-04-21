"use client";

import { useState, useEffect, useCallback } from "react";
import { getSetting, saveSetting } from "@/lib/db";

const SETTING_KEY = "selectedMicrophoneId";

interface Props {
  disabled?: boolean;
  onDeviceChange?: (deviceId: string) => void;
}

export default function MicrophoneSelector({ disabled, onDeviceChange }: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const enumerate = useCallback(async () => {
    try {
      // Need permission to see device labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());

      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = all.filter((d) => d.kind === "audioinput");
      setDevices(mics);
      return mics;
    } catch {
      setDevices([]);
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mics = await enumerate();
      const saved = await getSetting(SETTING_KEY);

      if (cancelled) return;

      // Use saved device if still available, otherwise fall back to default
      const match = mics.find((d) => d.deviceId === saved);
      const initial = match ? saved! : mics[0]?.deviceId ?? "";
      setSelectedId(initial);
      onDeviceChange?.(initial);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-enumerate when devices change (e.g. plugging in a mic)
  useEffect(() => {
    const handler = () => enumerate();
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handler);
  }, [enumerate]);

  async function handleChange(deviceId: string) {
    setSelectedId(deviceId);
    await saveSetting(SETTING_KEY, deviceId);
    onDeviceChange?.(deviceId);
  }

  if (loading) return null;
  if (devices.length <= 1) return null; // No point showing selector for a single mic

  return (
    <div className="flex items-center gap-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400 shrink-0">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
      </svg>
      <select
        value={selectedId}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className="text-xs text-zinc-600 bg-transparent border border-zinc-200 rounded-lg px-2 py-1.5 outline-none hover:border-zinc-300 focus:border-zinc-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed max-w-[200px] truncate"
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
          </option>
        ))}
      </select>
    </div>
  );
}

export { SETTING_KEY };
