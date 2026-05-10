"use client";

import { useState } from "react";

const VOICES = ["Puck", "Charon", "Kore", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"];

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

function buildSystemPrompt(f: Settings): string {
  const name = f.ai_name || "Aria";
  const lines: string[] = [];

  if (f.business_name) {
    lines.push(`You are {ai_name}, a voice AI agent for ${f.business_name}.`);
  } else {
    lines.push(`You are {ai_name}, a friendly and helpful voice assistant.`);
  }

  if (f.business_description) {
    lines.push(`\nAbout the business: ${f.business_description}`);
  }

  if (f.agent_goal) {
    lines.push(`\nYour goal: ${f.agent_goal}`);
  }

  lines.push(
    `\nYou are in a live voice call — respond only with natural spoken words. Keep every reply to 1-3 short sentences. Never use markdown, lists, or special formatting. Be conversational and helpful.`
  );

  return lines.join("").replace(/{ai_name}/g, name);
}

export function SettingsForm({
  apiKey,
  initial,
}: {
  apiKey: string;
  initial: Settings | null;
}) {
  const [form, setForm] = useState<Settings>({
    ai_name: initial?.ai_name ?? "Aria",
    voice: initial?.voice ?? "Puck",
    greeting: initial?.greeting ?? "Hey! I'm {ai_name}. How can I help you today?",
    business_name: initial?.business_name ?? "",
    business_description: initial?.business_description ?? "",
    agent_goal: initial?.agent_goal ?? "",
    system_prompt:
      initial?.system_prompt ??
      "You are {ai_name}, a friendly and helpful voice assistant. You are in a live voice call — respond only with natural spoken words. Keep every reply to 1-3 short sentences. Never use markdown, lists, or special formatting.",
    timezone: initial?.timezone ?? "UTC",
    language: initial?.language ?? "en",
    data_collection_enabled: initial?.data_collection_enabled ?? false,
});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

  const set = (key: keyof Settings, value: string | boolean) =>
    setForm((p) => ({ ...p, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Agent Identity ── */}
      <Section label="Agent Identity" description="Name and voice of your AI agent.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Agent Name">
            <input
              value={form.ai_name}
              onChange={(e) => set("ai_name", e.target.value)}
              placeholder="Aria"
              required
            />
          </Field>
          <Field label="Voice">
            <select value={form.voice} onChange={(e) => set("voice", e.target.value)}>
              {VOICES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* ── Business Context ── */}
      <Section label="Business Context" description="Tell the agent about your business so it can represent you accurately.">
        <Field label="Business Name" hint="The company or product this agent represents.">
          <input
            value={form.business_name}
            onChange={(e) => set("business_name", e.target.value)}
            placeholder="Acme Corp"
          />
        </Field>
        <Field
          label="What does your business do?"
          hint="Describe your products, services, or industry in a few sentences."
          mt
        >
          <textarea
            rows={3}
            value={form.business_description}
            onChange={(e) => set("business_description", e.target.value)}
            placeholder="We provide B2B software that helps teams manage customer support tickets…"
            style={{ resize: "vertical" }}
          />
        </Field>
        <Field
          label="Agent Goal"
          hint="What should the agent accomplish on each call?"
          mt
        >
          <textarea
            rows={2}
            value={form.agent_goal}
            onChange={(e) => set("agent_goal", e.target.value)}
            placeholder="Qualify inbound leads, answer product questions, and book a demo if the caller is interested."
            style={{ resize: "vertical" }}
          />
        </Field>
      </Section>

      {/* ── Data Collection ── */}
      <Section label="Data Collection" description="Configure what structured data the agent collects from conversations.">
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={form.data_collection_enabled}
            onChange={(e) => set("data_collection_enabled", e.target.checked)}
          />
          <span style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
            Enable data collection — agent will capture structured data during calls
          </span>
        </label>
        <p style={{ margin: "8px 0 0", fontSize: "0.78rem", color: "var(--color-muted)" }}>
          Configure what fields to collect in{" "}
          <a href="/dashboard/data" style={{ color: "var(--color-accent-light)" }}>
            Collected Data → Schema Configuration
          </a>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
          <Field label="Timezone">
            <select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {["UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Tokyo","Asia/Singapore","Australia/Sydney"].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <select value={form.language} onChange={(e) => set("language", e.target.value)}>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* ── Conversation ── */}
      <Section label="Conversation" description="How the agent opens and conducts calls.">
        <Field
          label="First Message"
          hint={<>What the agent says when the call connects. Use <Code>{"{ai_name}"}</Code> as a placeholder.</>}
        >
          <input
            value={form.greeting}
            onChange={(e) => set("greeting", e.target.value)}
            placeholder="Hey! I'm {ai_name}. How can I help?"
          />
        </Field>

        <Field label="System Prompt" mt>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => set("system_prompt", buildSystemPrompt(form))}
              style={{
                fontSize: "0.72rem",
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "var(--color-surface-2)",
                color: "var(--color-accent-light)",
                cursor: "pointer",
              }}
            >
              Generate from context ↑
            </button>
          </div>
          <textarea
            rows={6}
            value={form.system_prompt}
            onChange={(e) => set("system_prompt", e.target.value)}
            style={{ resize: "vertical" }}
          />
          <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--color-muted)" }}>
            Instructions sent to the AI on every call. Business context above is automatically prepended — no need to repeat it here.
          </p>
        </Field>
      </Section>

      {error && (
        <p style={{ color: "var(--color-danger)", fontSize: "0.875rem", margin: 0 }}>{error}</p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "10px 24px",
            background: "var(--color-accent)",
            color: "#fff",
            fontWeight: 600,
            borderRadius: 8,
            border: "none",
            cursor: saving ? "default" : "pointer",
            fontSize: "0.875rem",
          }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && (
          <span style={{ color: "var(--color-success)", fontSize: "0.875rem" }}>Saved</span>
        )}
      </div>
    </form>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function Section({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.05)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem", color: "var(--color-text)" }}>
          {label}
        </p>
        {description && (
          <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--color-muted)" }}>
            {description}
          </p>
        )}
      </div>
      <div style={{ padding: "1.25rem 1.5rem" }}>{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  mt,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  mt?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: mt ? "1rem" : 0 }}>
      <label
        style={{
          display: "block",
          fontSize: "0.8rem",
          fontWeight: 500,
          color: "var(--color-text)",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--color-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ color: "var(--color-accent-light)", fontSize: "0.72rem" }}>{children}</code>
  );
}
