import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { Mic, PhoneCall, Clock, FileText, ChevronRight } from "lucide-react";

interface CallLog {
  id: number;
  started_at: string;
  ended_at: string;
  duration_secs: number;
  transcript: string;
  user_audio_path: string;
  ai_audio_path: string;
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RecordingsPage() {
  const session = await getSession();
  if (!session) return null;

  let calls: CallLog[] = [];
  try {
    calls = await apiFetch<CallLog[]>("/api/calls", session.apiKey, { cache: "no-store" });
  } catch {
    /* empty */
  }

  return (
    <div className="">
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-text mb-1">Recordings</h1>
        <p className="text-sm text-muted">
          Every call is saved automatically — transcript and audio.
        </p>
      </div>

      {calls.length === 0 ? (
        <div className="bg-surface border border-white/10 rounded-xl px-6 py-16 flex flex-col items-center text-center">
          <div className="w-11 h-11 rounded-xl bg-surface-2 border border-white/10 flex items-center justify-center mb-4">
            <Mic className="w-5 h-5 text-muted" />
          </div>
          <p className="text-sm font-medium text-text mb-1">No recordings yet</p>
          <p className="text-xs text-muted mb-5">Start a voice call to create your first recording.</p>
          <Link
            href="/dashboard/call"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors shadow-sm"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Start a call
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {calls.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/recordings/${c.id}`}
              className="group flex items-center gap-3 bg-surface border border-white/10 rounded-xl px-4 py-3 hover:border-white/18 hover:bg-surface-2 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <PhoneCall className="w-3.5 h-3.5 text-accent-light" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-text mb-0.5">{formatDate(c.started_at)}</p>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(c.duration_secs)}
                  </span>
                  {c.transcript && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      transcript
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {c.user_audio_path && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/15 font-medium">
                    audio
                  </span>
                )}
                {c.transcript && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-light border border-accent/15 font-medium">
                    transcript
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted/30 group-hover:text-muted/70 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
