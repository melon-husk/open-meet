"use client";

import { useState, useEffect } from "react";
import { Meeting, saveMeeting } from "@/lib/db";
import {
  summarizeMeeting,
  chatWithSummary,
  checkAISupport,
} from "@/lib/summarize";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export default function MeetingDetail({ meeting: initial }: { meeting: Meeting }) {
  const [meeting, setMeeting] = useState(initial);
  const [activeTab, setActiveTab] = useState<
    "summary" | "transcript" | "notes" | "chat"
  >(meeting.summary ? "summary" : "transcript");
  const [notes, setNotes] = useState(meeting.notes);
  const [notesEdited, setNotesEdited] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [aiStatus, setAiStatus] = useState<"checking" | "ready" | "no">(
    "checking"
  );

  useEffect(() => {
    checkAISupport().then((s) => setAiStatus(s === "no" ? "no" : "ready"));
  }, []);

  const transcript = meeting.segments.map((s) => s.text).join(" ");
  const hasSummary = !!meeting.summary;
  const showRegenerate = hasSummary && notesEdited;

  async function saveNotes() {
    const updated = { ...meeting, notes };
    await saveMeeting(updated);
    setMeeting(updated);
  }

  async function handleGenerateSummary() {
    if (aiStatus === "no") return;
    setSummarizing(true);
    try {
      const updated = { ...meeting, notes, status: "summarizing" as const };
      await saveMeeting(updated);

      const summary = await summarizeMeeting(transcript, notes);
      const done = { ...updated, summary, status: "done" as const };
      await saveMeeting(done);
      setMeeting(done);
      setNotesEdited(false);
      setActiveTab("summary");
    } catch {
      const failed = { ...meeting, notes, status: "summary_failed" as const };
      await saveMeeting(failed);
      setMeeting(failed);
    }
    setSummarizing(false);
  }

  async function handleChat() {
    const q = chatInput.trim();
    if (!q) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: q }]);
    setChatLoading(true);
    try {
      const answer = await chatWithSummary(meeting.summary, transcript, q);
      setChatMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, couldn't process that. AI may not be available.",
        },
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

        {/* Generate / Regenerate summary */}
        <div className="mt-3 flex items-center gap-2">
          {!hasSummary && meeting.status !== "summary_failed" && (
            <button
              onClick={handleGenerateSummary}
              disabled={summarizing || aiStatus === "no" || !transcript.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-30"
            >
              {summarizing ? "Generating…" : "Generate Summary"}
            </button>
          )}
          {showRegenerate && (
            <button
              onClick={handleGenerateSummary}
              disabled={summarizing}
              className="px-3 py-1.5 text-xs font-medium text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              {summarizing ? "Regenerating…" : "Regenerate Summary"}
            </button>
          )}
          {meeting.status === "summary_failed" && (
            <button
              onClick={handleGenerateSummary}
              disabled={summarizing}
              className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {summarizing ? "Retrying…" : "Retry Summary"}
            </button>
          )}
          {aiStatus === "no" && (
            <span className="text-[10px] text-amber-500">
              Chrome AI unavailable — enable Gemini Nano in chrome://flags
            </span>
          )}
        </div>
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
            {tab.id === "notes" && notesEdited && (
              <span className="ml-1 w-1.5 h-1.5 bg-amber-400 rounded-full inline-block" />
            )}
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
              <div className="text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">
                {meeting.summary}
              </div>
            ) : (
              <p className="text-zinc-400 text-sm py-8 text-center">
                No summary yet — click &quot;Generate Summary&quot; above
              </p>
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
          <div className="flex flex-col h-full gap-3">
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesEdited(true);
              }}
              placeholder="Add or edit your notes… Updates here will let you regenerate the summary."
              className="flex-1 min-h-[200px] resize-none text-sm text-zinc-700 leading-relaxed outline-none placeholder:text-zinc-300 bg-zinc-50/50 rounded-lg p-3 border border-zinc-100"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveNotes}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Save Notes
              </button>
              {notesEdited && hasSummary && (
                <span className="text-[10px] text-amber-500">
                  Notes changed — regenerate summary to reflect updates
                </span>
              )}
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          <div className="flex flex-col h-full">
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
