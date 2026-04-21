"use client";

import { useState, useEffect } from "react";
import { getSetting, saveSetting } from "@/lib/db";

const SETTING_KEY = "selectedLanguage";

export const LANGUAGES = [
  { code: "hi-IN", label: "Hindi" },
  { code: "en-IN", label: "English (India)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "kn-IN", label: "Kannada" },
  { code: "mr-IN", label: "Marathi" },
  { code: "bn-IN", label: "Bengali" },
] as const;

export const DEFAULT_LANG = "hi-IN";

interface Props {
  disabled?: boolean;
  onLanguageChange?: (lang: string) => void;
}

export default function LanguageSelector({ disabled, onLanguageChange }: Props) {
  const [selectedLang, setSelectedLang] = useState<string>(DEFAULT_LANG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSetting(SETTING_KEY).then((saved) => {
      if (cancelled) return;
      const lang = saved && LANGUAGES.some((l) => l.code === saved) ? saved : DEFAULT_LANG;
      setSelectedLang(lang);
      onLanguageChange?.(lang);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChange(lang: string) {
    setSelectedLang(lang);
    await saveSetting(SETTING_KEY, lang);
    onLanguageChange?.(lang);
  }

  if (loading) return null;

  return (
    <select
      value={selectedLang}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled}
      className="text-xs text-zinc-600 bg-transparent border border-zinc-200 rounded-lg px-2 py-1.5 outline-none hover:border-zinc-300 focus:border-zinc-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

export { SETTING_KEY };
