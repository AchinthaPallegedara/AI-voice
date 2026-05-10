import { getSession } from "@/lib/session";
import { VoiceCall } from "@/components/VoiceCall";

export default async function CallPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--color-text)", margin: "0 0 4px" }}>
        Voice Call
      </h1>
      <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginTop: 0, marginBottom: "2rem" }}>
        Talk live with your AI voice agent.
      </p>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.05)",
          padding: "2rem",
        }}
      >
        <VoiceCall apiKey={session.apiKey} />
      </div>
    </div>
  );
}
