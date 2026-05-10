"use client";

import { useState } from "react";

const VOICES: { name: string; description: string; gender: "M" | "F" }[] = [
  { name: "Puck",            description: "Upbeat & playful",       gender: "M" },
  { name: "Charon",          description: "Calm & informative",     gender: "M" },
  { name: "Kore",            description: "Firm & confident",       gender: "F" },
  { name: "Fenrir",          description: "Energetic & bold",       gender: "M" },
  { name: "Aoede",           description: "Breezy & warm",          gender: "F" },
  { name: "Leda",            description: "Youthful & friendly",    gender: "F" },
  { name: "Orus",            description: "Deep & steady",          gender: "M" },
  { name: "Zephyr",          description: "Bright & clear",         gender: "F" },
  { name: "Altair",          description: "Rich & expressive",      gender: "M" },
  { name: "Autonoe",         description: "Soft & natural",         gender: "F" },
  { name: "Callirrhoe",      description: "Easy-going & smooth",    gender: "F" },
  { name: "Enceladus",       description: "Breathy & gentle",       gender: "M" },
  { name: "Iocaste",         description: "Warm & clear",           gender: "F" },
  { name: "Rasalgethi",      description: "Informative & composed", gender: "M" },
  { name: "Sadaltager",      description: "Knowledgeable & smooth", gender: "M" },
  { name: "Schedar",         description: "Even & grounded",        gender: "F" },
  { name: "Sulafat",         description: "Warm & resonant",        gender: "F" },
  { name: "Umbriel",         description: "Easy & casual",          gender: "M" },
  { name: "Vindemiatrix",    description: "Gentle & expressive",    gender: "F" },
  { name: "Zubenelgenubi",   description: "Casual & relaxed",       gender: "M" },
];

const LANGUAGES = [
  { code: "auto", label: "Auto-detect" },
  { code: "en",   label: "English" },
  { code: "si",   label: "Sinhala" },
  { code: "es",   label: "Spanish" },
  { code: "fr",   label: "French" },
  { code: "de",   label: "German" },
  { code: "pt",   label: "Portuguese" },
  { code: "ja",   label: "Japanese" },
  { code: "zh",   label: "Chinese" },
  { code: "ar",   label: "Arabic" },
  { code: "hi",   label: "Hindi" },
  { code: "ko",   label: "Korean" },
  { code: "it",   label: "Italian" },
];

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

interface Template {
  id: string;
  label: string;
  icon: string;
  fields: Partial<Settings>;
}

const VOICE_CALL_BASE =
  "You are in a live voice call — respond only with natural spoken words. Keep every reply to 1-3 short sentences. Never use markdown, lists, or special formatting. Be conversational and helpful.";

const OUT_OF_SCOPE =
  "If the caller asks about anything unrelated to our business or services, politely let them know you can only assist with topics related to our business and gently redirect the conversation.";

const TEMPLATES: Template[] = [
  {
    id: "salon",
    label: "Hair Salon",
    icon: "✂️",
    fields: {
      ai_name: "Luna",
      voice: "Kore",
      business_name: "Glamour Hair Salon",
      business_description:
        "A full-service hair salon offering haircuts, coloring, highlights, blowouts, styling, and hair treatments for all hair types.",
      agent_goal:
        "Help customers book appointments, answer questions about services and pricing, share salon hours and location, and handle appointment cancellations or rescheduling.",
      greeting: "Hi! I'm {ai_name} from Glamour Hair Salon. How can I help you today?",
      system_prompt: `You are {ai_name}, the friendly virtual receptionist for Glamour Hair Salon. Only answer questions related to our salon services, appointments, pricing, hours, and location. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}`,
    },
  },
  {
    id: "pc_shop",
    label: "PC Shop",
    icon: "💻",
    fields: {
      ai_name: "Byte",
      voice: "Orus",
      business_name: "TechHub PC Shop",
      business_description:
        "A computer hardware and repair shop specializing in custom PC builds, laptop and desktop repairs, hardware upgrades, software troubleshooting, and accessories.",
      agent_goal:
        "Help customers with product inquiries, repair bookings, pricing estimates, stock availability, store hours, and warranty information.",
      greeting: "Hey there! I'm {ai_name} from TechHub PC Shop. What can I help you with today?",
      system_prompt: `You are {ai_name}, the virtual assistant for TechHub PC Shop. Only answer questions related to our computer products, repair services, pricing, stock, and store information. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}`,
    },
  },
  {
    id: "restaurant",
    label: "Restaurant",
    icon: "🍽️",
    fields: {
      ai_name: "Marco",
      voice: "Fenrir",
      business_name: "The Golden Fork Restaurant",
      business_description:
        "A family-friendly restaurant serving Italian and Mediterranean cuisine, including pasta, pizza, seafood, and vegetarian options. Open for lunch and dinner.",
      agent_goal:
        "Help customers make table reservations, answer questions about the menu, dietary options, opening hours, location, and handle reservation changes.",
      greeting: "Welcome to The Golden Fork! I'm {ai_name}. How can I assist you today?",
      system_prompt: `You are {ai_name}, the virtual assistant for The Golden Fork Restaurant. Only answer questions related to our restaurant, menu, reservations, hours, and location. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}`,
    },
  },
  {
    id: "clinic",
    label: "Medical Clinic",
    icon: "🏥",
    fields: {
      ai_name: "Care",
      voice: "Aoede",
      business_name: "HealthFirst Clinic",
      business_description:
        "A general medical clinic offering GP consultations, health checkups, vaccinations, and specialist referrals.",
      agent_goal:
        "Help patients book or reschedule appointments, answer questions about clinic services, opening hours, and what to bring. Never provide medical advice.",
      greeting: "Hello, you've reached HealthFirst Clinic. I'm {ai_name}. How can I help you?",
      system_prompt: `You are {ai_name}, the virtual receptionist for HealthFirst Clinic. Only assist with appointment booking, clinic information, services offered, and general administrative questions. Never give medical diagnoses or treatment advice — always direct medical questions to our doctors. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}`,
    },
  },
  {
    id: "real_estate",
    label: "Real Estate",
    icon: "🏠",
    fields: {
      ai_name: "Alex",
      voice: "Puck",
      business_name: "Prime Realty",
      business_description:
        "A real estate agency helping buyers, sellers, and renters with residential and commercial properties. We offer property listings, valuations, and agent consultations.",
      agent_goal:
        "Help callers inquire about property listings, book property viewings, get information about the buying or rental process, and connect with an agent.",
      greeting: "Hi! I'm {ai_name} from Prime Realty. Looking to buy, sell, or rent?",
      system_prompt: `You are {ai_name}, the virtual assistant for Prime Realty. Only answer questions about our property listings, real estate services, valuations, and the buying or rental process. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}`,
    },
  },
  {
    id: "gym",
    label: "Gym / Fitness",
    icon: "💪",
    fields: {
      ai_name: "Rex",
      voice: "Zephyr",
      business_name: "PowerFit Gym",
      business_description:
        "A modern fitness center offering gym memberships, personal training, group fitness classes, cardio equipment, and strength training facilities.",
      agent_goal:
        "Help people with membership inquiries, class schedules, personal training bookings, gym tours, and pricing.",
      greeting: "Hey! I'm {ai_name} from PowerFit Gym. Ready to get fit? How can I help?",
      system_prompt: `You are {ai_name}, the virtual assistant for PowerFit Gym. Only answer questions about our gym facilities, membership plans, classes, personal training, and pricing. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}`,
    },
  },
];

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
    `\n${OUT_OF_SCOPE} ${VOICE_CALL_BASE}`
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
    timezone: initial?.timezone ?? "Asia/Colombo",
    language: initial?.language ?? "auto",
    data_collection_enabled: initial?.data_collection_enabled ?? false,
});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  function applyTemplate(t: Template) {
    setActiveTemplate(t.id);
    setForm((prev) => ({ ...prev, ...t.fields }));
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

  async function previewVoice(voice: string) {
    if (previewingVoice) return;
    setPreviewingVoice(voice);
    try {
      const res = await fetch(`${API_URL}/api/settings/preview-voice?voice=${voice}`, {
        headers: { "X-API-Key": apiKey },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const pcmBuffer = await res.arrayBuffer();
      const sampleRate = parseInt(res.headers.get("X-Sample-Rate") ?? "24000", 10);
      const ctx = new AudioContext({ sampleRate });
      const samples = new Int16Array(pcmBuffer);
      const audioBuf = ctx.createBuffer(1, samples.length, sampleRate);
      const ch = audioBuf.getChannelData(0);
      for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(ctx.destination);
      src.onended = () => { setPreviewingVoice(null); ctx.close(); };
      src.start();
    } catch {
      setPreviewingVoice(null);
    }
  }

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

      {/* ── Quick Start Templates ── */}
      <Section
        label="Quick Start Templates"
        description="Pick a template to instantly populate all fields for a common business type."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "0.75rem 0.5rem",
                borderRadius: 10,
                border: activeTemplate === t.id
                  ? "1.5px solid var(--color-accent)"
                  : "1px solid rgba(255,255,255,0.1)",
                background: activeTemplate === t.id
                  ? "rgba(var(--color-accent-rgb, 99,102,241),0.12)"
                  : "var(--color-surface-2)",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-text)" }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
        {activeTemplate && (
          <p style={{ margin: "10px 0 0", fontSize: "0.75rem", color: "var(--color-accent-light)" }}>
            Template applied — all fields below have been pre-filled. You can edit any of them.
          </p>
        )}
      </Section>

      {/* ── Agent Identity ── */}
      <Section label="Agent Identity" description="Name, voice, and language of your AI agent.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Agent Name">
            <input
              value={form.ai_name}
              onChange={(e) => set("ai_name", e.target.value)}
              placeholder="Aria"
              required
            />
          </Field>
          <div style={{ marginTop: 4 }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--color-text)", marginBottom: 8 }}>
              Voice
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
              {VOICES.map((v) => {
                const selected = form.voice === v.name;
                const loading = previewingVoice === v.name;
                return (
                  <div
                    key={v.name}
                    onClick={() => set("voice", v.name)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: selected
                        ? "1px solid rgba(var(--color-accent-rgb,99,102,241),0.4)"
                        : "1px solid rgba(255,255,255,0.06)",
                      borderLeft: selected ? "3px solid var(--color-accent)" : "3px solid transparent",
                      background: selected ? "rgba(var(--color-accent-rgb,99,102,241),0.08)" : "var(--color-surface-2)",
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                  >
                    {/* Selected dot */}
                    <div style={{
                      flexShrink: 0,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: selected ? "var(--color-accent)" : "rgba(255,255,255,0.15)",
                      transition: "background 0.12s",
                    }} />

                    {/* Name + description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: selected ? 600 : 400, color: "var(--color-text)" }}>
                        {v.name}
                      </span>
                      <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--color-muted)" }}>
                        {v.description}
                      </span>
                    </div>

                    {/* Gender badge */}
                    <span style={{
                      flexShrink: 0,
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: v.gender === "F" ? "rgba(236,72,153,0.12)" : "rgba(59,130,246,0.12)",
                      color: v.gender === "F" ? "#f472b6" : "#60a5fa",
                    }}>
                      {v.gender === "F" ? "Female" : "Male"}
                    </span>

                    {/* Play button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); previewVoice(v.name); }}
                      disabled={!!previewingVoice}
                      title={`Preview ${v.name}`}
                      style={{
                        flexShrink: 0,
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        border: "none",
                        background: loading
                          ? "var(--color-accent)"
                          : selected
                          ? "rgba(var(--color-accent-rgb,99,102,241),0.2)"
                          : "rgba(255,255,255,0.06)",
                        color: loading ? "#fff" : "var(--color-accent-light)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: previewingVoice ? "default" : "pointer",
                        fontSize: loading ? "0.7rem" : "0.75rem",
                        transition: "background 0.12s",
                      }}
                    >
                      {loading ? "⏸" : "▶"}
                    </button>
                  </div>
                );
              })}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--color-muted)" }}>
              Click ▶ to hear a voice sample before selecting.
            </p>
          </div>
        </div>
        <Field label="Response Language" hint={form.language === "auto" ? "Agent detects the caller's language automatically and replies in the same language." : "The agent will always speak and respond in this language."} mt>
          <select value={form.language} onChange={(e) => set("language", e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </Field>
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
        <div style={{ marginTop: "1rem", maxWidth: 280 }}>
          <Field label="Timezone">
            <select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {["UTC","Asia/Colombo","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Tokyo","Asia/Singapore","Australia/Sydney"].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
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
