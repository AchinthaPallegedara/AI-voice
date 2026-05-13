"use client";

import { useState } from "react";
import { Play, Pause, CheckCircle2, Wand2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

const VOICES: { name: string; description: string; gender: "M" | "F" }[] = [
  { name: "Puck",          description: "Upbeat & playful",       gender: "M" },
  { name: "Charon",        description: "Calm & informative",     gender: "M" },
  { name: "Kore",          description: "Firm & confident",       gender: "F" },
  { name: "Fenrir",        description: "Energetic & bold",       gender: "M" },
  { name: "Aoede",         description: "Breezy & warm",          gender: "F" },
  { name: "Leda",          description: "Youthful & friendly",    gender: "F" },
  { name: "Orus",          description: "Deep & steady",          gender: "M" },
  { name: "Zephyr",        description: "Bright & clear",         gender: "F" },
  { name: "Altair",        description: "Rich & expressive",      gender: "M" },
  { name: "Autonoe",       description: "Soft & natural",         gender: "F" },
  { name: "Callirrhoe",    description: "Easy-going & smooth",    gender: "F" },
  { name: "Enceladus",     description: "Breathy & gentle",       gender: "M" },
  { name: "Iocaste",       description: "Warm & clear",           gender: "F" },
  { name: "Rasalgethi",    description: "Informative & composed", gender: "M" },
  { name: "Sadaltager",    description: "Knowledgeable & smooth", gender: "M" },
  { name: "Schedar",       description: "Even & grounded",        gender: "F" },
  { name: "Sulafat",       description: "Warm & resonant",        gender: "F" },
  { name: "Umbriel",       description: "Easy & casual",          gender: "M" },
  { name: "Vindemiatrix",  description: "Gentle & expressive",    gender: "F" },
  { name: "Zubenelgenubi", description: "Casual & relaxed",       gender: "M" },
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

const TIMEZONES = [
  "UTC","Asia/Colombo","America/New_York","America/Chicago",
  "America/Denver","America/Los_Angeles","Europe/London",
  "Europe/Paris","Asia/Tokyo","Asia/Singapore","Australia/Sydney",
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
  { id: "salon",       label: "Hair Salon",     icon: "✂️",  fields: { ai_name: "Luna",  voice: "Kore",   business_name: "Glamour Hair Salon",      business_description: "A full-service hair salon offering haircuts, coloring, highlights, blowouts, styling, and hair treatments for all hair types.", agent_goal: "Help customers book appointments, answer questions about services and pricing, share salon hours and location, and handle appointment cancellations or rescheduling.", greeting: "Hi! I'm {ai_name} from Glamour Hair Salon. How can I help you today?",                    system_prompt: `You are {ai_name}, the friendly virtual receptionist for Glamour Hair Salon. Only answer questions related to our salon services, appointments, pricing, hours, and location. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}` } },
  { id: "pc_shop",     label: "PC Shop",        icon: "💻",  fields: { ai_name: "Byte",  voice: "Orus",   business_name: "TechHub PC Shop",          business_description: "A computer hardware and repair shop specializing in custom PC builds, laptop and desktop repairs, hardware upgrades, software troubleshooting, and accessories.", agent_goal: "Help customers with product inquiries, repair bookings, pricing estimates, stock availability, store hours, and warranty information.", greeting: "Hey there! I'm {ai_name} from TechHub PC Shop. What can I help you with today?",           system_prompt: `You are {ai_name}, the virtual assistant for TechHub PC Shop. Only answer questions related to our computer products, repair services, pricing, stock, and store information. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}` } },
  { id: "restaurant",  label: "Restaurant",     icon: "🍽️", fields: { ai_name: "Marco", voice: "Fenrir", business_name: "The Golden Fork Restaurant", business_description: "A family-friendly restaurant serving Italian and Mediterranean cuisine, including pasta, pizza, seafood, and vegetarian options. Open for lunch and dinner.", agent_goal: "Help customers make table reservations, answer questions about the menu, dietary options, opening hours, location, and handle reservation changes.", greeting: "Welcome to The Golden Fork! I'm {ai_name}. How can I assist you today?",                 system_prompt: `You are {ai_name}, the virtual assistant for The Golden Fork Restaurant. Only answer questions related to our restaurant, menu, reservations, hours, and location. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}` } },
  { id: "clinic",      label: "Medical Clinic", icon: "🏥",  fields: { ai_name: "Care",  voice: "Aoede",  business_name: "HealthFirst Clinic",        business_description: "A general medical clinic offering GP consultations, health checkups, vaccinations, and specialist referrals.", agent_goal: "Help patients book or reschedule appointments, answer questions about clinic services, opening hours, and what to bring. Never provide medical advice.", greeting: "Hello, you've reached HealthFirst Clinic. I'm {ai_name}. How can I help you?",             system_prompt: `You are {ai_name}, the virtual receptionist for HealthFirst Clinic. Only assist with appointment booking, clinic information, services offered, and general administrative questions. Never give medical diagnoses or treatment advice — always direct medical questions to our doctors. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}` } },
  { id: "real_estate", label: "Real Estate",    icon: "🏠",  fields: { ai_name: "Alex",  voice: "Puck",   business_name: "Prime Realty",              business_description: "A real estate agency helping buyers, sellers, and renters with residential and commercial properties. We offer property listings, valuations, and agent consultations.", agent_goal: "Help callers inquire about property listings, book property viewings, get information about the buying or rental process, and connect with an agent.", greeting: "Hi! I'm {ai_name} from Prime Realty. Looking to buy, sell, or rent?",                       system_prompt: `You are {ai_name}, the virtual assistant for Prime Realty. Only answer questions about our property listings, real estate services, valuations, and the buying or rental process. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}` } },
  { id: "gym",         label: "Gym / Fitness",  icon: "💪",  fields: { ai_name: "Rex",   voice: "Zephyr", business_name: "PowerFit Gym",              business_description: "A modern fitness center offering gym memberships, personal training, group fitness classes, cardio equipment, and strength training facilities.", agent_goal: "Help people with membership inquiries, class schedules, personal training bookings, gym tours, and pricing.", greeting: "Hey! I'm {ai_name} from PowerFit Gym. Ready to get fit? How can I help?",                  system_prompt: `You are {ai_name}, the virtual assistant for PowerFit Gym. Only answer questions about our gym facilities, membership plans, classes, personal training, and pricing. ${OUT_OF_SCOPE} ${VOICE_CALL_BASE}` } },
];

function buildSystemPrompt(f: Settings): string {
  const lines: string[] = [];
  lines.push(f.business_name
    ? `You are {ai_name}, a voice AI agent for ${f.business_name}.`
    : `You are {ai_name}, a friendly and helpful voice assistant.`
  );
  if (f.business_description) lines.push(`\nAbout the business: ${f.business_description}`);
  if (f.agent_goal)           lines.push(`\nYour goal: ${f.agent_goal}`);
  lines.push(`\n${OUT_OF_SCOPE} ${VOICE_CALL_BASE}`);
  return lines.join("").replace(/{ai_name}/g, f.ai_name || "Aria");
}

/* ── shared field input class ── */
const fieldCls =
  "w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-sm text-text placeholder:text-muted outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15 font-[inherit]";

export function SettingsForm({ apiKey, initial }: { apiKey: string; initial: Settings | null }) {
  const [form, setForm] = useState<Settings>({
    ai_name:                 initial?.ai_name                ?? "Aria",
    voice:                   initial?.voice                  ?? "Puck",
    greeting:                initial?.greeting               ?? "Hey! I'm {ai_name}. How can I help you today?",
    business_name:           initial?.business_name          ?? "",
    business_description:    initial?.business_description   ?? "",
    agent_goal:              initial?.agent_goal             ?? "",
    system_prompt:           initial?.system_prompt          ?? "You are {ai_name}, a friendly and helpful voice assistant. You are in a live voice call — respond only with natural spoken words. Keep every reply to 1-3 short sentences. Never use markdown, lists, or special formatting.",
    timezone:                initial?.timezone               ?? "Asia/Colombo",
    language:                initial?.language               ?? "auto",
    data_collection_enabled: initial?.data_collection_enabled ?? false,
  });

  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState("");
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [previewingVoice,setPreviewingVoice]= useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

  function applyTemplate(t: Template) {
    setActiveTemplate(t.id);
    setForm((prev) => ({ ...prev, ...t.fields }));
  }

  const set = (key: keyof Settings, value: string | boolean) =>
    setForm((p) => ({ ...p, [key]: value }));

  async function previewVoice(voice: string) {
    if (previewingVoice) return;
    setPreviewingVoice(voice);
    try {
      const res = await fetch(`${API_URL}/api/settings/preview-voice?voice=${voice}`, {
        headers: { "X-API-Key": apiKey },
      });
      if (!res.ok) throw new Error();
      const pcmBuffer  = await res.arrayBuffer();
      const sampleRate = parseInt(res.headers.get("X-Sample-Rate") ?? "24000", 10);
      const ctx        = new AudioContext({ sampleRate });
      const samples    = new Int16Array(pcmBuffer);
      const audioBuf   = ctx.createBuffer(1, samples.length, sampleRate);
      const ch         = audioBuf.getChannelData(0);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* ── Quick Start Templates ── */}
      <Section label="Quick Start Templates" description="Pick a template to pre-fill all fields for a common business type.">
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.map((t) => {
            const active = activeTemplate === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className={cn(
                  "flex flex-col items-center gap-2 py-3 px-2 rounded-lg border text-center transition-all cursor-pointer",
                  active
                    ? "border-accent bg-accent/10 text-text"
                    : "border-white/8 bg-surface-2 text-muted hover:border-white/18 hover:text-text"
                )}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                <span className="text-xs font-medium leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>
        {activeTemplate && (
          <p className="mt-3 text-xs text-accent-light flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            Template applied — all fields have been pre-filled. You can edit any of them.
          </p>
        )}
      </Section>

      {/* ── Agent Identity ── */}
      <Section label="Agent Identity" description="Name, voice, and language of your AI agent.">
        <div className="flex flex-col gap-4">

          {/* Agent name + Language row */}
          <div className="grid grid-cols-2 gap-3">
            <Label label="Agent Name">
              <input
                className={fieldCls}
                value={form.ai_name}
                onChange={(e) => set("ai_name", e.target.value)}
                placeholder="Aria"
                required
              />
            </Label>
            <Label label="Response Language">
              <select
                className={fieldCls}
                value={form.language}
                onChange={(e) => set("language", e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1">
                {form.language === "auto"
                  ? "Detects the caller's language automatically."
                  : "Agent always responds in this language."}
              </p>
            </Label>
          </div>

          {/* Voice picker */}
          <div>
            <p className="text-xs font-medium text-muted mb-2">Voice</p>
            <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto pr-1">
              {VOICES.map((v) => {
                const selected = form.voice === v.name;
                const loading  = previewingVoice === v.name;
                return (
                  <div
                    key={v.name}
                    onClick={() => set("voice", v.name)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
                      selected
                        ? "border-accent/40 bg-accent/8 border-l-2 border-l-accent"
                        : "border-white/6 bg-surface-2 hover:border-white/12 hover:bg-surface-3"
                    )}
                  >
                    {/* dot */}
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors",
                      selected ? "bg-accent" : "bg-white/20"
                    )} />

                    {/* name + description */}
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm", selected ? "font-semibold text-text" : "text-text/80")}>
                        {v.name}
                      </span>
                      <span className="ml-2 text-xs text-muted">{v.description}</span>
                    </div>

                    {/* gender */}
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0",
                      v.gender === "F"
                        ? "bg-pink-500/10 text-pink-400"
                        : "bg-blue-500/10 text-blue-400"
                    )}>
                      {v.gender === "F" ? "F" : "M"}
                    </span>

                    {/* play button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); previewVoice(v.name); }}
                      disabled={!!previewingVoice}
                      title={`Preview ${v.name}`}
                      className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer",
                        loading
                          ? "bg-accent text-white"
                          : selected
                          ? "bg-accent/20 text-accent-light hover:bg-accent/30"
                          : "bg-white/6 text-muted hover:bg-white/12 hover:text-text"
                      )}
                    >
                      {loading
                        ? <Pause className="w-3 h-3" />
                        : <Play  className="w-3 h-3" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted mt-2">Click ▶ to hear a sample before selecting.</p>
          </div>
        </div>
      </Section>

      {/* ── Business Context ── */}
      <Section label="Business Context" description="Tell the agent about your business so it can represent you accurately.">
        <div className="flex flex-col gap-4">
          <Label label="Business Name" hint="The company or product this agent represents.">
            <input
              className={fieldCls}
              value={form.business_name}
              onChange={(e) => set("business_name", e.target.value)}
              placeholder="Acme Corp"
            />
          </Label>
          <Label label="What does your business do?" hint="Describe your products, services, or industry in a few sentences.">
            <textarea
              className={cn(fieldCls, "resize-y")}
              rows={3}
              value={form.business_description}
              onChange={(e) => set("business_description", e.target.value)}
              placeholder="We provide B2B software that helps teams manage customer support tickets…"
            />
          </Label>
          <Label label="Agent Goal" hint="What should the agent accomplish on each call?">
            <textarea
              className={cn(fieldCls, "resize-y")}
              rows={2}
              value={form.agent_goal}
              onChange={(e) => set("agent_goal", e.target.value)}
              placeholder="Qualify inbound leads, answer product questions, and book a demo if the caller is interested."
            />
          </Label>
        </div>
      </Section>

      {/* ── Conversation ── */}
      <Section label="Conversation" description="How the agent opens and conducts calls.">
        <div className="flex flex-col gap-4">
          <Label
            label="First Message"
            hint={<>What the agent says when the call connects. Use <code className="text-accent-light text-[11px] bg-accent/8 px-1 py-0.5 rounded">{"{ai_name}"}</code> as a placeholder.</>}
          >
            <input
              className={fieldCls}
              value={form.greeting}
              onChange={(e) => set("greeting", e.target.value)}
              placeholder="Hey! I'm {ai_name}. How can I help?"
            />
          </Label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted">System Prompt</p>
              <button
                type="button"
                onClick={() => set("system_prompt", buildSystemPrompt(form))}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-white/10 bg-surface-2 text-accent-light hover:bg-surface-3 hover:border-white/18 transition-all cursor-pointer"
              >
                <Wand2 className="w-3 h-3" />
                Generate from context
              </button>
            </div>
            <textarea
              className={cn(fieldCls, "resize-y")}
              rows={6}
              value={form.system_prompt}
              onChange={(e) => set("system_prompt", e.target.value)}
            />
            <p className="text-xs text-muted mt-1.5">
              Instructions sent to the AI on every call. Business context above is automatically prepended.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Settings ── */}
      <Section label="Settings" description="Data collection and timezone preferences.">
        <div className="flex flex-col gap-4">

          {/* Toggle */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-2 border border-white/8">
            <label className="relative flex-shrink-0 cursor-pointer mt-0.5">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.data_collection_enabled}
                onChange={(e) => set("data_collection_enabled", e.target.checked)}
              />
              <div className="w-9 h-5 rounded-full border border-white/15 bg-surface-3 peer-checked:bg-accent peer-checked:border-accent transition-all" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white/40 peer-checked:bg-white peer-checked:translate-x-4 transition-all" />
            </label>
            <div>
              <p className="text-sm font-medium text-text">Enable data collection</p>
              <p className="text-xs text-muted mt-0.5">
                Agent will capture structured data during calls.{" "}
                <a href="/dashboard/data" className="text-accent-light hover:underline">
                  Configure schema →
                </a>
              </p>
            </div>
          </div>

          {/* Timezone */}
          <div className="max-w-xs">
            <Label label="Timezone">
              <select
                className={fieldCls}
                value={form.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </Label>
          </div>
        </div>
      </Section>

      {/* ── Submit ── */}
      {error && (
        <p className="text-xs text-danger bg-danger/8 border border-danger/18 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm shadow-accent/20"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

/* ── helpers ── */

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
    <div className="bg-surface border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/8">
        <p className="text-sm font-semibold text-text">{label}</p>
        {description && (
          <p className="text-xs text-muted mt-0.5">{description}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Label({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted">{label}</p>
      {children}
      {hint && <p className="text-xs text-muted leading-relaxed">{hint}</p>}
    </div>
  );
}
