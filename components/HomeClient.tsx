"use client";

import { useState } from "react";
import Link from "next/link";
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
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </Link>
            {view === "list" ? (
              <button
                onClick={() => setView("record")}
                data-umami-event="new-meeting-click"
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
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 flex flex-col min-h-0">
          {view === "list" ? <MeetingList /> : <RecordingSession />}
        </main>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-zinc-100">
          <p className="text-[10px] text-zinc-500 text-center">
            Everything runs locally in your browser · No data leaves your device
            <br />
            <span className="text-zinc-400">
              Anonymous page analytics via self-hosted{" "}
              <a href="https://umami.is" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">Umami</a>
              {" "}· No cookies · Respects Do Not Track
            </span>
          </p>
        </footer>
      </div>
    </div>
  );
}
