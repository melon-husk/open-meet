"use client";

import { useEffect, useState } from "react";
import { Meeting, getAllMeetings, deleteMeeting } from "@/lib/db";

export default function MeetingList() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAllMeetings().then((m) => {
      setMeetings(m);
      setLoaded(true);
    });
  }, []);

  async function handleDelete(id: string) {
    await deleteMeeting(id);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  }

  if (!loaded) {
    return <p className="text-zinc-400 text-sm py-12 text-center">Loading…</p>;
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400 text-lg">No meetings yet</p>
        <p className="text-zinc-300 text-sm mt-1">
          Start a new recording to capture your first meeting
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {meetings.map((m) => (
        <li key={m.id} className="group">
          <a
            href={`/meeting/${m.id}`}
            className="flex items-center justify-between py-4 px-1 hover:bg-zinc-50 rounded-lg transition-colors -mx-1"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-900 truncate">
                {m.title}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {new Date(m.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  m.status === "done"
                    ? "bg-emerald-50 text-emerald-600"
                    : m.status === "recorded"
                      ? "bg-blue-50 text-blue-600"
                      : m.status === "recording"
                        ? "bg-red-50 text-red-500"
                        : m.status === "summarizing"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {m.status === "done"
                  ? "Summarized"
                  : m.status === "recorded"
                    ? "Recorded"
                    : m.status === "recording"
                      ? "Recording"
                      : m.status === "summarizing"
                        ? "Summarizing…"
                        : "Failed"}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(m.id);
                }}
                data-umami-event="delete-meeting"
                className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-400 transition-all p-1"
                aria-label="Delete meeting"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                </svg>
              </button>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
