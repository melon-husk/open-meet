"use client";

import { useState } from "react";
import { Meeting, saveMeeting } from "@/lib/db";
import { summarizeMeeting, chatWithSummary } from "@/lib/summarize";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export default function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const [activeTab, setActiveTab] = useState<
    "summary" | "transcript" | "notes" | "chat"
  >(meeting.summary ? "summary" : "transcript");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const transcript = meeting.segments.map((s) => s.text).join(" ");

  async function handleRetrySummary() {
    setRetrying(true);
    try {
      const summary = await summarizeMeeting(transcript, meeting.notes);
      meeting.summary = summary;
      meeting.status = "done";
      await saveMeeting(meeting);
      setActiveTab("summary");
    } catch {
      // keep failed state
    }
    setRetrying(false);
  }

  async function handleChat() {
    const q = chatInput.trim();
    if (!q) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: q }]);
    setChatLoading(true);
    try {
      const answer = await chatWithSummary(
        meeting.summary,
        transcript,
        q
      );
      setChatMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Sorry, couldn't process that. AI may not be available." },
      ]);
    }
    setChatLoading(false);
  }

  const tabs = [
    { id: "summary" as const, label: "Summary" },
    { id: "transcript" as const, label: "Transcript" },
    { id: "notes" as const, label: "Notes" },
    { id: "chat" as const, label: "Chat" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-100">
        <a
          href="/"
          className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          ← Back
        </a>
        <h1 className="text-xl font-semibold text-zinc-900 mt-2">
          {meeting.title}
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          {new Date(meeting.date).toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-4 border-b border-zinc-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-zinc-900"
                : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 mt-4 overflow-y-auto min-h-0">
        {activeTab === "summary" && (
          <div>
            {meeting.summary ? (
              <div className="prose prose-sm prose-zinc max-w-none text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">
                {meeting.summary}
              </div>
            ) : (
              <p className="text-zinc-400 text-sm">No summary available.</p>
            )}
            {meeting.status === "summary_failed" && (
              <button
                onClick={handleRetrySummary}
                disabled={retrying}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
              >
                {retrying ? "Retrying…" : "Retry Summary"}
              </button>
            )}
          </div>
        )}

        {activeTab === "transcript" && (
          <div className="text-sm text-zinc-600 leading-relaxed">
            {transcript || (
              <p className="text-zinc-400">No transcript recorded.</p>
            )}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
            {meeting.notes || (
              <p className="text-zinc-400">No notes taken.</p>
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div className="flex flex-col h-full">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {chatMessages.length === 0 && (
                <p className="text-zinc-300 text-sm text-center py-8">
                  Ask anything about this meeting
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      msg.role === "user"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-100 text-zinc-400 px-3 py-2 rounded-xl text-sm">
                    Thinking…
                  </div>
                </div>
              )}
            </div>

            {/* Chat input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleChat();
              }}
              className="flex gap-2 pt-3 border-t border-zinc-100"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about this meeting…"
                className="flex-1 text-sm outline-none bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100 placeholder:text-zinc-300"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="px-3 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-30"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
