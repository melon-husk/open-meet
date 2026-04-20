"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Meeting, TranscriptSegment, saveMeeting } from "@/lib/db";
import {
  isSupported as isSpeechSupported,
  createSpeechRecognizer,
  SpeechController,
} from "@/lib/speech";
import { summarizeMeeting, checkAISupport } from "@/lib/summarize";

export default function RecordingSession() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState("");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<
    "idle" | "recording" | "summarizing" | "done" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState<"checking" | "ready" | "no">(
    "checking"
  );

  const speechRef = useRef<SpeechController | null>(null);
  const meetingRef = useRef<Meeting | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAISupport().then((s) => setAiStatus(s === "no" ? "no" : "ready"));
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, interim]);

  // Autosave every 10 seconds while recording
  useEffect(() => {
    if (!isRecording || !meetingRef.current) return;
    const interval = setInterval(() => {
      if (meetingRef.current) {
        meetingRef.current.segments = segments;
        meetingRef.current.notes = notes;
        saveMeeting(meetingRef.current);
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [isRecording, segments, notes]);

  const handleSegment = useCallback((seg: TranscriptSegment) => {
    if (seg.isFinal) {
      setSegments((prev) => [...prev, seg]);
      setInterim("");
    } else {
      setInterim(seg.text);
    }
  }, []);

  const handleSpeechError = useCallback((err: string) => {
    setError(`Mic error: ${err}`);
  }, []);

  function startRecording() {
    if (!isSpeechSupported()) {
      setError("Speech recognition not supported. Use Chrome or Edge.");
      return;
    }

    const id = crypto.randomUUID();
    const meeting: Meeting = {
      id,
      title: title.trim() || `Meeting — ${new Date().toLocaleString("en-IN")}`,
      date: new Date().toISOString(),
      segments: [],
      notes: "",
      summary: "",
      status: "recording",
    };
    meetingRef.current = meeting;
    saveMeeting(meeting);

    const controller = createSpeechRecognizer(handleSegment, handleSpeechError);
    speechRef.current = controller;
    controller.start();
    setIsRecording(true);
    setStatus("recording");
    setError("");
  }

  async function stopRecording() {
    speechRef.current?.stop();
    setIsRecording(false);
    setStatus("summarizing");

    const meeting = meetingRef.current!;
    meeting.segments = segments;
    meeting.notes = notes;
    meeting.status = "summarizing";
    await saveMeeting(meeting);

    const transcript = segments.map((s) => s.text).join(" ");

    if (aiStatus === "no" || !transcript.trim()) {
      meeting.status = transcript.trim() ? "summary_failed" : "done";
      meeting.summary = transcript.trim()
        ? "AI summarization not available in this browser."
        : "";
      await saveMeeting(meeting);
      setStatus("done");
      router.push(`/meeting/${meeting.id}`);
      return;
    }

    try {
      const summary = await summarizeMeeting(transcript, notes);
      meeting.summary = summary;
      meeting.status = "done";
      await saveMeeting(meeting);
      setStatus("done");
      router.push(`/meeting/${meeting.id}`);
    } catch {
      meeting.status = "summary_failed";
      meeting.summary = "Summarization failed. You can retry from the meeting page.";
      await saveMeeting(meeting);
      setStatus("error");
      router.push(`/meeting/${meeting.id}`);
    }
  }

  const transcriptText = segments.map((s) => s.text).join(" ");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
        <div className="flex-1 min-w-0">
          {status === "idle" ? (
            <input
              type="text"
              placeholder="Meeting title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-medium text-zinc-900 placeholder:text-zinc-300 w-full outline-none bg-transparent"
            />
          ) : (
            <h2 className="text-lg font-medium text-zinc-900 truncate">
              {meetingRef.current?.title}
            </h2>
          )}
        </div>
        <div className="ml-4 flex items-center gap-3">
          {isRecording && (
            <span className="flex items-center gap-1.5 text-xs text-red-500">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Recording
            </span>
          )}
          {status === "idle" && (
            <button
              onClick={startRecording}
              className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Start Recording
            </button>
          )}
          {status === "recording" && (
            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              Stop & Summarize
            </button>
          )}
          {status === "summarizing" && (
            <span className="text-sm text-amber-600">Summarizing…</span>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-3 px-1">{error}</p>
      )}

      {aiStatus === "no" && status === "idle" && (
        <p className="text-xs text-amber-500 mt-3 px-1">
          ⚠ Chrome AI not available. Transcription will work but summarization
          won&apos;t. Enable Gemini Nano in chrome://flags.
        </p>
      )}

      {/* Content area — transcript + notes side by side */}
      {status !== "idle" && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 min-h-0">
          {/* Transcript */}
          <div className="flex flex-col min-h-0">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Transcript
            </h3>
            <div className="flex-1 overflow-y-auto text-sm text-zinc-600 leading-relaxed space-y-1 pr-2">
              {transcriptText && <p>{transcriptText}</p>}
              {interim && (
                <p className="text-zinc-300 italic">{interim}</p>
              )}
              {!transcriptText && !interim && (
                <p className="text-zinc-300">Listening…</p>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col min-h-0">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Type your notes here… These will enhance the summary."
              className="flex-1 resize-none text-sm text-zinc-700 leading-relaxed outline-none placeholder:text-zinc-300 bg-zinc-50/50 rounded-lg p-3 border border-zinc-100"
              disabled={status === "summarizing"}
            />
          </div>
        </div>
      )}

      {/* Idle state */}
      {status === "idle" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
              </svg>
            </div>
            <p className="text-zinc-400 text-sm">
              Press &quot;Start Recording&quot; to begin capturing your meeting
            </p>
            <p className="text-zinc-300 text-xs mt-1">
              Speech is transcribed locally · Nothing leaves your browser
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
