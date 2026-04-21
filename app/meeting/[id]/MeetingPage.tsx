"use client";

import { useEffect, useState } from "react";
import { Meeting, getMeeting } from "@/lib/db";
import MeetingDetail from "@/components/MeetingDetail";
import Link from "next/link";

export default function MeetingPage({ id }: { id: string }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getMeeting(id).then((m) => {
      if (m) setMeeting(m);
      else setNotFound(true);
    });
  }, [id]);

  if (notFound) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <p className="text-zinc-400 text-sm">Meeting not found</p>
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-700 mt-2"
        >
          ← Back to meetings
        </Link>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <p className="text-zinc-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center">
      <div className="w-full max-w-2xl flex flex-col flex-1 px-6 py-8 min-h-0">
        <MeetingDetail meeting={meeting} />
        <footer className="mt-8 pt-4 border-t border-zinc-100">
          <p className="text-[10px] text-zinc-300 text-center">
            Everything runs locally in your browser · No data leaves your device
          </p>
        </footer>
      </div>
    </div>
  );
}
