import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { SettingsForm } from "@/components/SettingsForm";

interface AgentSettings {
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

  let settings: AgentSettings | null = null;
  try {
    settings = await apiFetch<AgentSettings>("/api/settings", session.apiKey, { cache: "no-store" });
  } catch {
    /* first load — form shows defaults */
  }

  return (
    <div className="">
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-text mb-1">Agent Setup</h1>
        <p className="text-sm text-muted">
          Configure your AI agent&apos;s identity, business context, and conversation behaviour.
        </p>
      </div>
      <SettingsForm apiKey={session.apiKey} initial={settings} />
    </div>
  );
}
