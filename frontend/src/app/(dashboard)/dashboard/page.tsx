import { getSession } from "@/lib/session";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getSession();

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--color-text)", margin: "0 0 4px" }}>
        Dashboard
      </h1>
      <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginTop: 0, marginBottom: "2rem" }}>
        Welcome back,{" "}
        <span style={{ color: "var(--color-accent-light)" }}>{session?.orgName}</span>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <QuickCard
          href="/dashboard/call"
          title="Start a Call"
          description="Launch a live voice conversation with your AI agent."
          iconBg="rgba(6,214,160,0.12)"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#06d6a0">
              <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.02l-2.21 2.2z" />
            </svg>
          }
        />
        <QuickCard
          href="/dashboard/settings"
          title="Configure Agent"
          description="Set your AI's name, voice, and behaviour."
          iconBg="rgba(124,92,191,0.12)"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#9b7fe8">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          }
        />
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.05)",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ color: "var(--color-text)", fontSize: "1rem", fontWeight: 500, marginTop: 0, marginBottom: "0.75rem" }}>
          Getting started
        </h2>
        <ol style={{ color: "var(--color-muted)", fontSize: "0.875rem", paddingLeft: "1.25rem", margin: 0, lineHeight: 1.8 }}>
          <li>
            Go to{" "}
            <Link href="/dashboard/settings" style={{ color: "var(--color-accent-light)" }}>
              Settings
            </Link>{" "}
            to give your AI a name and personality.
          </li>
          <li>
            Head to{" "}
            <Link href="/dashboard/call" style={{ color: "var(--color-accent-light)" }}>
              Voice Call
            </Link>{" "}
            and press the button to start talking.
          </li>
          <li>Allow microphone access when prompted by your browser.</li>
        </ol>
      </div>
    </div>
  );
}

function QuickCard({
  href,
  title,
  description,
  icon,
  iconBg,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.05)",
          padding: "1.25rem",
          transition: "border-color 0.15s",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          {icon}
        </div>
        <p style={{ margin: "0 0 4px", fontWeight: 500, color: "var(--color-text)", fontSize: "0.9rem" }}>{title}</p>
        <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.8rem", lineHeight: 1.5 }}>{description}</p>
      </div>
    </Link>
  );
}
