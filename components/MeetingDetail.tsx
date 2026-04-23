"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Meeting, TranscriptSegment, saveMeeting, appendSegment, updateMeetingFields, saveAudioChunk, getAudioChunks, getSetting } from "@/lib/db";
import { summarizeMeeting, chatWithSummary } from "@/lib/summarize";
import {
  isSupported as isSpeechSupported,
  createSpeechRecognizer,
  SpeechController,
} from "@/lib/speech";
import { useWhisper, WhisperDevice } from "@/lib/useWhisper";
import LanguageSelector, { DEFAULT_LANG } from "@/components/LanguageSelector";
import Markdown from "react-markdown";
import Link from "next/link";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export default function MeetingDetail({
  meeting: initial,
}: {
  meeting: Meeting;
}) {
  const [meeting, setMeeting] = useState(initial);
  const [activeTab, setActiveTab] = useState<
    "summary" | "transcript" | "notes" | "chat" | "audio"
  >(meeting.summary ? "summary" : "transcript");
  const [notes, setNotes] = useState(meeting.notes);
  const [notesEdited, setNotesEdited] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summarizerAvailability, setSummarizerAvailability] =
    useState<Availability>("unavailable");

  // Audio playback state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);

  // Transcribe-more state
  const [transcribing, setTranscribing] = useState(false);
  const [newSegments, setNewSegments] = useState<TranscriptSegment[]>([]);
  const [newInterim, setNewInterim] = useState("");
  const [transcribeError, setTranscribeError] = useState("");
  const speechRef = useRef<SpeechController | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const transcribeLangRef = useRef<string>(meeting.lang ?? DEFAULT_LANG);

  // Whisper retranscription state
  const whisper = useWhisper();
  const [whisperDevice, setWhisperDevice] = useState<WhisperDevice>("wasm");
  const [whisperRetranscribing, setWhisperRetranscribing] = useState(false);

  // Load saved whisper device preference
  useEffect(() => {
    getSetting("whisperDevice").then((saved) => {
      if (saved === "wasm" || saved === "webgpu") setWhisperDevice(saved);
    });
  }, []);

  useEffect(() => {
    if (!("Summarizer" in self)) {
      // The Summarizer API is NOT supported.
      return;
    }
    Summarizer.availability()
      .then((availability) => setSummarizerAvailability(availability))
      .catch((error) => {
        console.error(error);
        setSummarizerAvailability("unavailable");
      });
  }, []);

  // Load audio when Audio tab is selected
  useEffect(() => {
    if (activeTab !== "audio") return;
    let revoked = false;
    setAudioLoading(true);
    getAudioChunks(meeting.id).then((chunks) => {
      if (revoked) return;
      if (chunks.length === 0) {
        setHasAudio(false);
        setAudioLoading(false);
        return;
      }
      const blob = new Blob(chunks, { type: chunks[0].type || "audio/webm" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setHasAudio(true);
      setAudioLoading(false);
    });
    return () => {
      revoked = true;
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [activeTab, meeting.id]);

  const transcript = meeting.segments.map((s) => s.text).join(" ");
  const hasSummary = !!meeting.summary;
  const showRegenerate = hasSummary && notesEdited;

  async function saveNotes() {
    const updated = { ...meeting, notes };
    await saveMeeting(updated);
    setMeeting(updated);
  }

  async function handleGenerateSummary() {
    if (summarizerAvailability === "unavailable") return;
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

  const handleNewSegment = useCallback((seg: TranscriptSegment) => {
    if (seg.isFinal) {
      setNewSegments((prev) => [...prev, seg]);
      setNewInterim("");
      appendSegment(meeting.id, seg).catch(console.error);
    } else {
      setNewInterim(seg.text);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id]);

  const handleTranscribeError = useCallback((err: string) => {
    setTranscribeError(`Mic error: ${err}`);
  }, []);

  async function startTranscribing() {
    if (!isSpeechSupported()) {
      setTranscribeError("Speech recognition not supported. Use Chrome or Edge.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
    } catch (e) {
      setTranscribeError(`Could not access microphone: ${e}`);
      return;
    }
    const controller = createSpeechRecognizer(
      handleNewSegment,
      handleTranscribeError,
      transcribeLangRef.current
    );
    speechRef.current = controller;
    controller.start();

    // Start capturing audio
    const recorder = new MediaRecorder(micStreamRef.current!);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        saveAudioChunk(meeting.id, e.data).catch(console.error);
      }
    };
    recorder.start(5000);
    mediaRecorderRef.current = recorder;

    setTranscribing(true);
    setTranscribeError("");
    setActiveTab("transcript");
  }

  function restartWithLanguage(lang: string) {
    transcribeLangRef.current = lang;
    if (!transcribing || !speechRef.current) return;
    speechRef.current.stop();
    const controller = createSpeechRecognizer(
      handleNewSegment,
      handleTranscribeError,
      lang
    );
    speechRef.current = controller;
    controller.start();
  }

  async function stopTranscribing() {
    speechRef.current?.stop();
    // Stop audio recorder
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setTranscribing(false);
    setNewInterim("");

    if (newSegments.length > 0) {
      // Segments are already persisted individually via appendSegment.
      // Just update local state and save the lang.
      await updateMeetingFields(meeting.id, { lang: transcribeLangRef.current });
      const updated = {
        ...meeting,
        segments: [...meeting.segments, ...newSegments],
        lang: transcribeLangRef.current,
      };
      setMeeting(updated);
      setNewSegments([]);
      if (hasSummary) setNotesEdited(true);
    }
  }

  async function handleWhisperRetranscribe() {
    setWhisperRetranscribing(true);
    try {
      if (!whisper.modelLoaded) {
        await whisper.loadModel(whisperDevice);
      }

      const result = await whisper.transcribe(meeting.id, meeting.lang);
      const newSegs: TranscriptSegment[] = result.chunks.map((chunk) => ({
        text: chunk.text.trim(),
        timestamp: chunk.timestamp[0] * 1000,
        isFinal: true,
      }));

      const updated = { ...meeting, segments: newSegs };
      await saveMeeting(updated);
      setMeeting(updated);
      if (hasSummary) setNotesEdited(true);
      setActiveTab("transcript");
    } catch (e) {
      console.error("Whisper retranscription failed:", e);
    }
    setWhisperRetranscribing(false);
  }

  const tabs = [
    { id: "summary" as const, label: "Summary" },
    { id: "transcript" as const, label: "Transcript" },
    { id: "notes" as const, label: "Notes" },
    { id: "audio" as const, label: "Audio" },
    { id: "chat" as const, label: "Chat" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-100">
        <Link
          href="/"
          className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          ← Back
        </Link>
        <input
          type="text"
          value={meeting.title}
          onChange={(e) => setMeeting({ ...meeting, title: e.target.value })}
          onBlur={async () => {
            await updateMeetingFields(meeting.id, { title: meeting.title });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="text-xl font-semibold text-zinc-900 mt-2 w-full outline-none bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-zinc-400 transition-colors"
        />
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

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {!transcribing && (
            <LanguageSelector
              onLanguageChange={(lang) => { transcribeLangRef.current = lang; }}
            />
          )}
          {!transcribing && (
            <button
              onClick={startTranscribing}
              disabled={summarizing}
              data-umami-event="transcribe-more"
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
              </svg>
              Transcribe More
            </button>
          )}
          {transcribing && (
            <>
              <span className="flex items-center gap-1.5 text-xs text-red-500">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Recording
              </span>
              <LanguageSelector
                onLanguageChange={restartWithLanguage}
              />
              <button
                onClick={stopTranscribing}
                data-umami-event="stop-transcribe-more"
                className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Stop
              </button>
            </>
          )}
          {!transcribing && !hasSummary && meeting.status !== "summary_failed" && (
            <button
              onClick={handleGenerateSummary}
              disabled={
                summarizing ||
                summarizerAvailability === "unavailable" ||
                !transcript.trim()
              }
              data-umami-event="generate-summary"
              className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-30"
            >
              {summarizing ? "Generating…" : "Generate Summary"}
            </button>
          )}
          {!transcribing && showRegenerate && (
            <button
              onClick={handleGenerateSummary}
              disabled={summarizing}
              data-umami-event="regenerate-summary"
              className="px-3 py-1.5 text-xs font-medium text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              {summarizing ? "Regenerating…" : "Regenerate Summary"}
            </button>
          )}
          {!transcribing && meeting.status === "summary_failed" && (
            <button
              onClick={handleGenerateSummary}
              disabled={summarizing}
              data-umami-event="retry-summary"
              className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {summarizing ? "Retrying…" : "Retry Summary"}
            </button>
          )}
          {summarizerAvailability === "unavailable" && !transcribing && (
            <span className="text-[10px] text-amber-500">
              Chrome AI unavailable — enable Gemini Nano in chrome://flags
            </span>
          )}
        </div>

        {/* Whisper retranscription */}
        {!transcribing && hasAudio !== false && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <select
              value={whisperDevice}
              onChange={(e) => setWhisperDevice(e.target.value as WhisperDevice)}
              disabled={whisperRetranscribing || whisper.loading}
              className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white text-zinc-600 disabled:opacity-50"
            >
              <option value="wasm">Whisper (WASM)</option>
              {whisper.webgpuAvailable && (
                <option value="webgpu">Whisper (WebGPU)</option>
              )}
            </select>
            <button
              onClick={handleWhisperRetranscribe}
              disabled={whisperRetranscribing || whisper.loading || transcribing}
              data-umami-event="whisper-retranscribe"
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {whisperRetranscribing || whisper.loading
                ? "Retranscribing…"
                : "Retranscribe with Whisper"}
            </button>
            {(whisper.loading || whisperRetranscribing) && (
              <span className="text-[10px] text-zinc-400">
                {whisper.loading
                  ? `Loading model… ${(() => {
                      const last = whisper.progress.filter(
                        (p) => p.status === "progress" && p.progress != null
                      );
                      if (last.length === 0) return "";
                      const l = last[last.length - 1];
                      return `${Math.round(l.progress ?? 0)}%`;
                    })()}`
                  : whisper.transcribeProgress
                    ? `Transcribing… ${whisper.transcribeProgress.current}/${whisper.transcribeProgress.total} chunks`
                    : "Transcribing audio…"}
              </span>
            )}
            {whisper.error && (
              <span className="text-[10px] text-red-500">{whisper.error}</span>
            )}
          </div>
        )}
        {transcribeError && (
          <p className="text-xs text-red-500 mt-2">{transcribeError}</p>
        )}
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
              <Markdown>{meeting.summary}</Markdown>
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
              !transcribing && <p className="text-zinc-400">No transcript recorded.</p>
            )}
            {newSegments.length > 0 && (
              <p className={transcript ? "mt-2" : ""}>
                <span className="text-[10px] font-medium text-blue-500 uppercase tracking-wider mr-1">New</span>
                {newSegments.map((s) => s.text).join(" ")}
              </p>
            )}
            {newInterim && (
              <p className="text-zinc-300 italic">{newInterim}</p>
            )}
            {transcribing && !transcript && newSegments.length === 0 && !newInterim && (
              <p className="text-zinc-300">Listening…</p>
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
              className="flex-1 min-h-50 resize-none text-sm text-zinc-700 leading-relaxed outline-none placeholder:text-zinc-300 bg-zinc-50/50 rounded-lg p-3 border border-zinc-100"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveNotes}
                data-umami-event="save-notes"
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

        {activeTab === "audio" && (
          <div className="py-8 flex flex-col items-center gap-4">
            {audioLoading && (
              <p className="text-zinc-400 text-sm">Loading audio…</p>
            )}
            {hasAudio === false && !audioLoading && (
              <p className="text-zinc-400 text-sm">No audio recorded for this meeting.</p>
            )}
            {audioUrl && (
              <audio controls src={audioUrl} className="w-full max-w-md" />
            )}
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
                data-umami-event="chat-send"
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
