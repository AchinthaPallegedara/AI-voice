import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { WaveformPlayer } from "@/components/WaveformPlayer";

interface CallLog {
  id: number;
  started_at: string;
  ended_at: string;
  duration_secs: number;
  transcript: string;
  audio_path?: string;
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function RecordingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;

  let call: CallLog;
  try {
    call = await apiFetch<CallLog>(`/api/calls/${id}`, session.apiKey, { cache: "no-store" });
  } catch {
    notFound();
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/dashboard/recordings"
          style={{ color: "var(--color-muted)", fontSize: "0.8rem", textDecoration: "none" }}
        >
          ← Recordings
        </Link>
      </div>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--color-text)", margin: "0 0 4px" }}>
        {new Date(call.started_at).toLocaleString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </h1>
      <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginTop: 0, marginBottom: "2rem" }}>
        Duration: {formatDuration(call.duration_secs)}
      </p>

      {call.audio_path && (
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.05)",
            padding: "1.25rem",
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Recording
          </p>
          <WaveformPlayer src={`/api/recordings/${call.id}/audio`} />
        </div>
      )}

      {call.transcript ? (
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.05)",
            padding: "1.25rem",
          }}
        >
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Transcript
          </p>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-text)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {call.transcript}
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.05)",
            padding: "1.5rem",
            textAlign: "center",
            color: "var(--color-muted)",
            fontSize: "0.875rem",
          }}
        >
          No transcript available for this call.
        </div>
      )}
    </div>
  );
}
