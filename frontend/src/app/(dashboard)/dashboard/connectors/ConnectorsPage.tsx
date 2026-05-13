"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast, Toaster } from "sonner";
import type { APIConnector, WhatsAppChannel } from "./page";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhoneInfo {
  id: string;
  phone_number: string;
  name: string;
}

// ─── API connector helpers ────────────────────────────────────────────────────

const emptyConnector = (): Omit<APIConnector, "id"> => ({
  name: "",
  description: "",
  base_url: "",
  method: "GET",
  path_template: "",
  headers: "{}",
  body_template: "",
  params_schema: JSON.stringify({ type: "object", properties: {} }, null, 2),
  active: true,
});

const methodColors: Record<string, "success" | "warning" | "info"> = {
  GET: "info",
  POST: "success",
  PUT: "warning",
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConnectorsPage({
  initialConnectors,
  initialWhatsAppChannel,
  apiKey,
}: {
  initialConnectors: APIConnector[];
  initialWhatsAppChannel: WhatsAppChannel | null;
  apiKey: string;
}) {
  const [activeTab, setActiveTab] = useState<"channels" | "api">("channels");

  // ── API connectors state ──
  const [connectors, setConnectors] = useState(initialConnectors);
  const [connectorModal, setConnectorModal] = useState(false);
  const [editing, setEditing] = useState<APIConnector | null>(null);
  const [form, setForm] = useState(emptyConnector());
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testParams, setTestParams] = useState("{}");
  const [testing, setTesting] = useState(false);

  // ── WhatsApp state ──
  const [waChannel, setWaChannel] = useState<WhatsAppChannel | null>(initialWhatsAppChannel);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Phone selection (when the user has multiple WA numbers)
  const [phoneSelectModal, setPhoneSelectModal] = useState(false);
  const [pendingPhones, setPendingPhones] = useState<PhoneInfo[]>([]);
  const [pendingToken, setPendingToken] = useState("");
  const [selectingSaving, setSelectingSaving] = useState(false);

  // ─── API connector handlers ────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setForm(emptyConnector());
    setTestResult(null);
    setTestParams("{}");
    setConnectorModal(true);
  }

  function openEdit(c: APIConnector) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description,
      base_url: c.base_url,
      method: c.method,
      path_template: c.path_template,
      headers: c.headers || "{}",
      body_template: c.body_template,
      params_schema: c.params_schema,
      active: c.active,
    });
    setTestResult(null);
    setTestParams("{}");
    setConnectorModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.base_url.trim()) {
      toast.error("Name and Base URL are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await apiFetch<APIConnector>(`/api/connectors/${editing.id}`, apiKey, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        setConnectors((prev) => prev.map((c) => (c.id === editing.id ? updated : c)));
        toast.success("Connector updated");
      } else {
        const created = await apiFetch<APIConnector>("/api/connectors", apiKey, {
          method: "POST",
          body: JSON.stringify(form),
        });
        setConnectors((prev) => [created, ...prev]);
        toast.success("Connector created");
      }
      setConnectorModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: APIConnector) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    try {
      await apiFetch(`/api/connectors/${c.id}`, apiKey, { method: "DELETE" });
      setConnectors((prev) => prev.filter((x) => x.id !== c.id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleTest() {
    if (!editing) return;
    setTesting(true);
    setTestResult(null);
    try {
      let params: Record<string, unknown> = {};
      try { params = JSON.parse(testParams); } catch { /* ignore */ }
      const res = await apiFetch<{ result: string }>(`/api/connectors/${editing.id}/test`, apiKey, {
        method: "POST",
        body: JSON.stringify(params),
      });
      setTestResult(res.result);
    } catch (err: unknown) {
      setTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(false);
    }
  }

  // ─── WhatsApp OAuth flow ──────────────────────────────────────────────────

  async function handleConnectWhatsApp() {
    setWaConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/api/whatsapp/callback`;

      // 1. Get the Meta OAuth URL from our backend
      const { url } = await apiFetch<{ url: string }>(
        `/api/whatsapp-channel/oauth/url?redirect_uri=${encodeURIComponent(redirectUri)}`,
        apiKey
      );

      // 2. Open OAuth popup
      const popup = window.open(url, "whatsapp-oauth", "width=620,height=700,left=200,top=100");

      // 3. Wait for the callback page to postMessage the code
      const code = await new Promise<string>((resolve, reject) => {
        const onMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          const data = event.data as { type: string; code?: string; error?: string };
          if (data?.type === "wa-code") {
            window.removeEventListener("message", onMessage);
            resolve(data.code!);
          } else if (data?.type === "wa-error") {
            window.removeEventListener("message", onMessage);
            reject(new Error(data.error ?? "Authorization denied"));
          }
        };
        window.addEventListener("message", onMessage);

        // Bail if the user closes the popup manually
        const pollClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollClosed);
            window.removeEventListener("message", onMessage);
            reject(new Error("popup_closed"));
          }
        }, 500);
      });

      // 4. Exchange code for access token + phone numbers
      const { access_token, phone_numbers } = await apiFetch<{
        access_token: string;
        phone_numbers: PhoneInfo[];
      }>("/api/whatsapp-channel/oauth/exchange", apiKey, {
        method: "POST",
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      });

      if (!phone_numbers || phone_numbers.length === 0) {
        toast.error("No WhatsApp Business phone numbers found on this account.");
        return;
      }

      if (phone_numbers.length === 1) {
        // Auto-save the only number
        await saveChannel(phone_numbers[0], access_token);
      } else {
        // Let the user pick
        setPendingPhones(phone_numbers);
        setPendingToken(access_token);
        setPhoneSelectModal(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "popup_closed") toast.error(msg || "Failed to connect");
    } finally {
      setWaConnecting(false);
    }
  }

  async function saveChannel(phone: PhoneInfo, accessToken: string) {
    const saved = await apiFetch<WhatsAppChannel>("/api/whatsapp-channel", apiKey, {
      method: "POST",
      body: JSON.stringify({
        phone_number_id: phone.id,
        display_name: phone.name || phone.phone_number,
        access_token: accessToken,
        active: true,
      }),
    });
    setWaChannel(saved);
    toast.success("WhatsApp Business connected!");
  }

  async function handleSelectPhone(phone: PhoneInfo) {
    setSelectingSaving(true);
    try {
      await saveChannel(phone, pendingToken);
      setPhoneSelectModal(false);
    } catch {
      toast.error("Failed to save channel");
    } finally {
      setSelectingSaving(false);
    }
  }

  async function handleWaDisconnect() {
    if (!confirm("Disconnect WhatsApp Business? Your webhook in Meta will stop working.")) return;
    setWaDisconnecting(true);
    try {
      await apiFetch("/api/whatsapp-channel", apiKey, { method: "DELETE" });
      setWaChannel(null);
      toast.success("Disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setWaDisconnecting(false);
    }
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  }

  const webhookUrl = `${API_URL}/webhook/whatsapp/${apiKey}`;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <Toaster theme="dark" />

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--color-text)" }}>
          Connectors
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--color-muted)", fontSize: "0.875rem" }}>
          Connect messaging channels and external APIs to your voice agent
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          background: "var(--color-surface)",
          padding: 4,
          borderRadius: 10,
          width: "fit-content",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {(["channels", "api"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "7px 18px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "all 0.15s",
              background: activeTab === tab ? "var(--color-accent)" : "transparent",
              color: activeTab === tab ? "#fff" : "var(--color-muted)",
            }}
          >
            {tab === "channels" ? "Channels" : "API Tools"}
          </button>
        ))}
      </div>

      {/* ── Channels tab ── */}
      {activeTab === "channels" && (
        <div>
          <p style={{ margin: "0 0 20px", color: "var(--color-muted)", fontSize: "0.85rem" }}>
            Connect messaging channels so users can reach your voice agent from their preferred platform.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {/* WhatsApp Business card */}
            <Card>
              <CardHeader>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: "rgba(37,211,102,0.15)", color: "#25d366",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    <WhatsAppIcon size={22} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "0.95rem" }}>
                      WhatsApp Business
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 2 }}>
                      Meta Cloud API · Coexistence
                    </div>
                  </div>
                  <Badge variant={waChannel ? "success" : "neutral"}>
                    {waChannel ? "Connected" : "Not connected"}
                  </Badge>
                </div>
              </CardHeader>

              <CardBody>
                {waChannel ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {waChannel.display_name && (
                      <InfoRow label="Account" value={waChannel.display_name} />
                    )}
                    <InfoRow label="Phone Number ID" value={waChannel.phone_number_id} />

                    {/* Webhook URL */}
                    <CopyField
                      label="Webhook URL"
                      value={webhookUrl}
                      onCopy={() => copyText(webhookUrl, "Webhook URL")}
                    />

                    {/* Verify token */}
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginBottom: 4 }}>
                        Verify Token
                      </div>
                      <div
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          background: "var(--color-surface-2)", borderRadius: 6, padding: "6px 10px",
                        }}
                      >
                        <span
                          style={{
                            flex: 1, fontSize: "0.72rem", fontFamily: "monospace",
                            color: "var(--color-text)", letterSpacing: showToken ? 0 : 2,
                          }}
                        >
                          {showToken ? waChannel.verify_token : "••••••••••••••••"}
                        </span>
                        <IconBtn title={showToken ? "Hide" : "Show"} onClick={() => setShowToken((v) => !v)}>
                          {showToken ? <EyeOffIcon /> : <EyeIcon />}
                        </IconBtn>
                        <IconBtn title="Copy" onClick={() => copyText(waChannel.verify_token, "Verify Token")}>
                          <CopyIcon />
                        </IconBtn>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "10px 12px", borderRadius: 8, fontSize: "0.78rem",
                        color: "var(--color-muted)", lineHeight: 1.5,
                        background: "rgba(124,92,191,0.08)",
                      }}
                    >
                      Add the <span style={{ color: "var(--color-accent-light)" }}>Webhook URL</span> and{" "}
                      <span style={{ color: "var(--color-accent-light)" }}>Verify Token</span> in your{" "}
                      Meta App Dashboard under{" "}
                      <span style={{ color: "var(--color-text)" }}>WhatsApp → Configuration</span>.
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <Button
                        variant="danger"
                        size="sm"
                        style={{ flex: 1 }}
                        onClick={handleWaDisconnect}
                        loading={waDisconnecting}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                      Connect your existing WhatsApp Business number via Meta&apos;s Coexistence feature
                      — no new number required. Your customers can message your WhatsApp number and
                      your voice agent responds automatically.
                    </p>
                    <Button
                      onClick={handleConnectWhatsApp}
                      loading={waConnecting}
                      style={{ width: "100%", justifyContent: "center", gap: 10 }}
                      icon={<WhatsAppIcon size={16} />}
                    >
                      {waConnecting ? "Connecting…" : "Connect with WhatsApp Business"}
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Coming-soon placeholders */}
            <ComingSoonCard
              name="Telegram"
              color="rgba(36,161,222,0.15)"
              iconColor="#24a1de"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              }
            />
            <ComingSoonCard
              name="SMS / Twilio"
              color="rgba(255,90,0,0.15)"
              iconColor="#ff5a00"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                </svg>
              }
            />
          </div>
        </div>
      )}

      {/* ── API Tools tab ── */}
      {activeTab === "api" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.85rem" }}>
              External APIs the agent can call mid-conversation using function calling.
            </p>
            <Button onClick={openCreate}>+ Add Connector</Button>
          </div>

          {connectors.length === 0 ? (
            <Card>
              <CardBody style={{ textAlign: "center", padding: "48px 24px" }}>
                <p style={{ color: "var(--color-muted)", margin: "0 0 16px" }}>
                  No API connectors yet. Add one to let the agent fetch or write data mid-conversation.
                </p>
                <Button onClick={openCreate}>Add Connector</Button>
              </CardBody>
            </Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
              {connectors.map((c) => (
                <Card key={c.id}>
                  <CardHeader>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Badge variant={methodColors[c.method] ?? "neutral"}>{c.method}</Badge>
                      <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "0.9rem" }}>
                        {c.name}
                      </span>
                    </div>
                    {!c.active && <Badge variant="neutral">Inactive</Badge>}
                  </CardHeader>
                  <CardBody>
                    <p style={{ margin: "0 0 8px", color: "var(--color-muted)", fontSize: "0.8rem" }}>
                      {c.description || "No description"}
                    </p>
                    <p style={{ margin: "0 0 16px", color: "var(--color-accent-light)", fontSize: "0.75rem", fontFamily: "monospace" }}>
                      {c.base_url}{c.path_template}
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => openEdit(c)}>
                        Edit & Test
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(c)}>
                        Delete
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── API Connector modal ── */}
      <Modal
        open={connectorModal}
        onOpenChange={setConnectorModal}
        title={editing ? `Edit: ${editing.name}` : "Add API Connector"}
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConnectorModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Save Changes" : "Create Connector"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
            <Input
              label="Name (used as Gemini tool function name)"
              placeholder="e.g. lookup_customer"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div>
              <label style={{ fontSize: "0.8rem", color: "var(--color-muted)", fontWeight: 500, display: "block", marginBottom: 5 }}>
                Method
              </label>
              <select
                value={form.method}
                onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
                style={{ padding: "9px 12px", background: "var(--color-surface-2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "var(--color-text)", fontSize: "0.875rem" }}
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
              </select>
            </div>
          </div>
          <Textarea label="Description (shown to the agent)" placeholder="e.g. Look up a customer by phone number" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Base URL" placeholder="https://api.yourcrm.com" value={form.base_url} onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))} />
          <Input label="Path Template" placeholder="/customers/{phone}" hint="Use {param} placeholders matching your params schema" value={form.path_template} onChange={(e) => setForm((f) => ({ ...f, path_template: e.target.value }))} />
          <Textarea label="Headers (JSON)" placeholder='{"Authorization": "Bearer YOUR_TOKEN"}' rows={2} value={form.headers} onChange={(e) => setForm((f) => ({ ...f, headers: e.target.value }))} />
          <Textarea label="Parameters Schema (JSON Schema)" placeholder='{"type":"object","properties":{"phone":{"type":"string"}}}' rows={4} value={form.params_schema} onChange={(e) => setForm((f) => ({ ...f, params_schema: e.target.value }))} />
          {editing && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 14 }}>
              <Textarea label="Test Parameters (JSON)" rows={2} value={testParams} onChange={(e) => setTestParams(e.target.value)} />
              <Button variant="secondary" size="sm" onClick={handleTest} loading={testing} style={{ marginTop: 8 }}>
                Run Test
              </Button>
              {testResult && (
                <pre style={{ marginTop: 10, padding: 12, background: "var(--color-surface-2)", borderRadius: 8, fontSize: "0.75rem", color: "var(--color-text)", overflow: "auto", maxHeight: 120 }}>
                  {testResult}
                </pre>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Phone number selection modal ── */}
      <Modal
        open={phoneSelectModal}
        onOpenChange={setPhoneSelectModal}
        title="Select WhatsApp Number"
        width={480}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: "0 0 6px", fontSize: "0.875rem", color: "var(--color-muted)" }}>
            Multiple phone numbers found. Pick the one to connect:
          </p>
          {pendingPhones.map((phone) => (
            <button
              key={phone.id}
              onClick={() => handleSelectPhone(phone)}
              disabled={selectingSaving}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                background: "var(--color-surface-2)", cursor: "pointer", textAlign: "left",
                color: "var(--color-text)", transition: "border-color 0.15s",
              }}
            >
              <div
                style={{
                  width: 36, height: 36, borderRadius: 8, background: "rgba(37,211,102,0.15)",
                  color: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <WhatsAppIcon size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{phone.name || "Unnamed"}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 2 }}>
                  {phone.phone_number} · ID: {phone.id}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.85rem", color: "var(--color-text)", fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

function CopyField({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--color-surface-2)", borderRadius: 6, padding: "6px 10px" }}>
        <span style={{ flex: 1, fontSize: "0.72rem", fontFamily: "monospace", color: "var(--color-accent-light)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value}
        </span>
        <IconBtn title="Copy" onClick={onCopy}><CopyIcon /></IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 2, display: "flex", alignItems: "center", flexShrink: 0 }}
    >
      {children}
    </button>
  );
}

function ComingSoonCard({ name, icon, color, iconColor }: { name: string; icon: React.ReactNode; color: string; iconColor: string }) {
  return (
    <Card style={{ opacity: 0.5 }}>
      <CardHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: color, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "0.95rem" }}>{name}</div>
          </div>
          <Badge variant="neutral">Coming soon</Badge>
        </div>
      </CardHeader>
      <CardBody>
        <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.85rem" }}>
          This channel will be available in a future update.
        </p>
      </CardBody>
    </Card>
  );
}
