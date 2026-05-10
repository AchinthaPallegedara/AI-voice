"use client";

import { useGeminiVoice, type CallState } from "@/hooks/useGeminiVoice";

const LABEL: Record<CallState, string> = {
  ready: "Ready",
  connecting: "Connecting…",
  idle: "Listening",
  recording: "You're speaking",
  speaking: "AI speaking",
  error: "Error",
};

const STATUS_COLOR: Record<CallState, string> = {
  ready: "var(--color-muted)",
  connecting: "var(--color-accent-light)",
  idle: "var(--color-success)",
  recording: "var(--color-danger)",
  speaking: "var(--color-accent-light)",
  error: "var(--color-danger)",
};

export function VoiceCall({ apiKey }: { apiKey: string }) {
  const { callState, transcript, error, startCall, endCall } = useGeminiVoice(apiKey);

  const active = callState !== "ready" && callState !== "error";
  const pulse = ["connecting", "recording", "speaking"].includes(callState);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        padding: "2rem 0",
      }}
    >
      {/* Status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 14px",
          borderRadius: 99,
          background: "var(--color-surface-2)",
          fontSize: "0.75rem",
          fontWeight: 500,
          color: STATUS_COLOR[callState],
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: STATUS_COLOR[callState],
            display: "inline-block",
          }}
        />
        {LABEL[callState]}
      </div>

      {/* Main button */}
      <div style={{ position: "relative" }}>
        {pulse && (
          <span
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: "50%",
              background: active ? "rgba(239,35,60,0.15)" : "rgba(124,92,191,0.15)",
              animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
        )}
        <button
          onClick={active ? endCall : startCall}
          aria-label={active ? "End call" : "Start call"}
          style={{
            position: "relative",
            width: 112,
            height: 112,
            borderRadius: "50%",
            background: active ? "var(--color-danger)" : "var(--color-accent)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 8px 32px ${active ? "rgba(239,35,60,0.35)" : "rgba(124,92,191,0.35)"}`,
          }}
        >
          {active ? <EndIcon /> : <CallIcon />}
        </button>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>

      <p style={{ color: "var(--color-muted)", fontSize: "0.8rem", textAlign: "center", maxWidth: 280, margin: 0 }}>
        {active
          ? "Click to end the call. Speak naturally — the AI detects your voice automatically."
          : "Click to start a live voice conversation with your AI agent."}
      </p>

      {error && (
        <div
          style={{
            background: "rgba(239,35,60,0.1)",
            border: "1px solid rgba(239,35,60,0.3)",
            borderRadius: 12,
            padding: "10px 16px",
            color: "var(--color-danger)",
            fontSize: "0.875rem",
            textAlign: "center",
            maxWidth: 400,
          }}
        >
          {error}
        </div>
      )}

      {transcript && (
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            background: "var(--color-surface-2)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.05)",
            padding: "1rem",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: "0.7rem", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Transcript
          </p>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {transcript}
          </p>
        </div>
      )}
    </div>
  );
}

function CallIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.02l-2.21 2.2z" />
    </svg>
  );
}

function EndIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
    </svg>
  );
}
