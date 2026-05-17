"use client";

import { useState } from "react";
import { Phone, Copy, CheckCircle2, Trash2, Save, ExternalLink } from "lucide-react";

const fieldCls =
  "w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-sm text-text placeholder:text-muted outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15 font-[inherit]";
import { toast } from "sonner";

interface TwilioChannel {
  account_sid: string;
  auth_token: string;
  phone_number: string;
  active: boolean;
}

interface Props {
  apiKey: string;
  initial: TwilioChannel | null;
  voiceWebhookUrl: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function TwilioChannelForm({ apiKey, initial, voiceWebhookUrl }: Props) {
  const [form, setForm] = useState<TwilioChannel>({
    account_sid: initial?.account_sid ?? "",
    auth_token: initial?.auth_token ?? "",
    phone_number: initial?.phone_number ?? "",
    active: initial?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const connected = !!initial;

  function set(k: keyof TwilioChannel, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.account_sid || !form.auth_token || !form.phone_number) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/twilio-channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Twilio channel saved");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Remove Twilio channel?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/twilio-channel`, {
        method: "DELETE",
        headers: { "X-API-Key": apiKey },
      });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
      toast.success("Twilio channel removed");
      setForm({ account_sid: "", auth_token: "", phone_number: "", active: true });
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function copyWebhook() {
    await navigator.clipboard.writeText(voiceWebhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-white/8">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            connected ? "bg-green-500/15" : "bg-white/6"
          }`}
        >
          <Phone
            className={`w-4 h-4 ${connected ? "text-green-400" : "text-muted"}`}
            strokeWidth={1.8}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">Twilio Voice</p>
          <p className="text-xs text-muted">
            {connected ? `Connected · ${initial?.phone_number}` : "Not connected"}
          </p>
        </div>
        {connected && (
          <span className="text-[11px] font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
            Active
          </span>
        )}
      </div>

      {/* Credentials */}
      <div className="p-5 rounded-xl bg-surface border border-white/8 space-y-4">
        <h2 className="text-sm font-semibold text-text">Credentials</h2>

        <Field label="Account SID">
          <input
            type="text"
            value={form.account_sid}
            onChange={(e) => set("account_sid", e.target.value)}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className={fieldCls}
          />
        </Field>

        <Field label="Auth Token">
          <input
            type="password"
            value={form.auth_token}
            onChange={(e) => set("auth_token", e.target.value)}
            placeholder="••••••••••••••••••••••••••••••••"
            className={fieldCls}
          />
        </Field>

        <Field label="Twilio Phone Number" hint="E.164 format, e.g. +15551234567">
          <input
            type="text"
            value={form.phone_number}
            onChange={(e) => set("phone_number", e.target.value)}
            placeholder="+15551234567"
            className={fieldCls}
          />
        </Field>
      </div>

      {/* Webhook URL */}
      <div className="p-5 rounded-xl bg-surface border border-white/8 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-text mb-0.5">Voice Webhook URL</h2>
          <p className="text-xs text-muted">
            Paste this URL into your Twilio phone number&apos;s{" "}
            <span className="text-text">Voice &amp; Fax</span> → A call comes in → Webhook.
          </p>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-white/4 border border-white/8">
          <code className="text-xs text-accent-light flex-1 min-w-0 truncate">
            {voiceWebhookUrl}
          </code>
          <button
            onClick={copyWebhook}
            className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/8 transition-colors"
            title="Copy"
          >
            {copied ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted" />
            )}
          </button>
        </div>

        <a
          href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-accent-light hover:underline"
        >
          Open Twilio Console
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save"}
        </button>

        {connected && (
          <button
            onClick={remove}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-text/80">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
