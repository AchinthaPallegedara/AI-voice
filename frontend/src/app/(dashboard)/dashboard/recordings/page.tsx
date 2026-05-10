import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

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
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--color-text)", margin: "0 0 4px" }}>
        Recordings
      </h1>
      <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginTop: 0, marginBottom: "2rem" }}>
        Every call is saved automatically — transcript and audio.
      </p>

      {calls.length === 0 ? (
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.05)",
            padding: "3rem",
            textAlign: "center",
            color: "var(--color-muted)",
            fontSize: "0.875rem",
          }}
        >
          No recordings yet. Start a voice call to create your first one.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {calls.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/recordings/${c.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--color-surface)",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.05)",
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "border-color 0.15s",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "rgba(124,92,191,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#9b7fe8">
                      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.02l-2.21 2.2z" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 500, color: "var(--color-text)", fontSize: "0.875rem" }}>
                      {formatDate(c.started_at)}
                    </p>
                    <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.75rem" }}>
                      {formatDuration(c.duration_secs)}
                      {c.transcript ? " · has transcript" : ""}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {c.user_audio_path && (
                    <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 99, background: "rgba(6,214,160,0.12)", color: "#06d6a0" }}>
                      audio
                    </span>
                  )}
                  {c.transcript && (
                    <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 99, background: "rgba(155,127,232,0.12)", color: "#9b7fe8" }}>
                      transcript
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
