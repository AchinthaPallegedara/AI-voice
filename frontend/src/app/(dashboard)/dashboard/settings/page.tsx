import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { SettingsForm } from "@/components/SettingsForm";

interface Settings {
  ai_name: string;
  voice: string;
  greeting: string;
  business_name: string;
  business_description: string;
  agent_goal: string;
  system_prompt: string;
  timezone: string;
  language: string;
  data_collection_enabled: boolean;
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  let settings: Settings | null = null;
  try {
    settings = await apiFetch<Settings>("/api/settings", session.apiKey, { cache: "no-store" });
  } catch {
    /* first load — form shows defaults */
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--color-text)", margin: "0 0 4px" }}>
        Agent Setup
      </h1>
      <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginTop: 0, marginBottom: "2rem" }}>
        Configure your AI agent&apos;s identity, business context, and conversation behaviour.
      </p>
      <SettingsForm apiKey={session.apiKey} initial={settings} />
    </div>
  );
}
