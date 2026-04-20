"use client";

import { useState } from "react";
import MeetingList from "@/components/MeetingList";
import RecordingSession from "@/components/RecordingSession";

export default function HomeClient() {
  const [view, setView] = useState<"list" | "record">("list");

  return (
    <div className="flex flex-col flex-1 items-center">
      <div className="w-full max-w-2xl flex flex-col flex-1 px-6 py-8">
        {/* Nav */}
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => setView("list")}
            className="text-base font-semibold text-zinc-900 tracking-tight"
          >
            Open Meet
          </button>
          {view === "list" ? (
            <button
              onClick={() => setView("record")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" fill="currentColor" />
              </svg>
              New Meeting
            </button>
          ) : (
            <button
              onClick={() => setView("list")}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              ← Meetings
            </button>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 flex flex-col min-h-0">
          {view === "list" ? <MeetingList /> : <RecordingSession />}
        </main>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-zinc-100">
          <p className="text-[10px] text-zinc-300 text-center">
            Everything runs locally in your browser · No data leaves your device
          </p>
        </footer>
      </div>
    </div>
  );
}
