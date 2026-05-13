"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast, Toaster } from "sonner";
import type { FieldDef, CollectedRecord } from "./page";

const FIELD_TYPES = ["text", "email", "phone", "number", "date", "boolean"];

export function DataPage({
  initialSchema,
  initialRecords,
  apiKey,
}: {
  initialSchema: FieldDef[];
  initialRecords: CollectedRecord[];
  apiKey: string;
}) {
  const [activeTab, setActiveTab] = useState<"data" | "schema">("data");
  const [schema, setSchema] = useState<FieldDef[]>(initialSchema);
  const [records] = useState<CollectedRecord[]>(initialRecords);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  function addField() {
    setSchema((s) => [...s, { name: "", label: "", type: "text", required: false }]);
  }

  function updateField(i: number, patch: Partial<FieldDef>) {
    setSchema((s) => s.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeField(i: number) {
    setSchema((s) => s.filter((_, idx) => idx !== i));
  }

  async function saveSchema() {
    for (const f of schema) {
      if (!f.name.trim() || !f.label.trim()) {
        toast.error("All fields need a name and label");
        return;
      }
    }
    setSaving(true);
    try {
      await apiFetch("/api/data-schema", apiKey, {
        method: "PUT",
        body: JSON.stringify(schema),
      });
      toast.success("Schema saved — agent will collect these fields in future calls");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function exportCSV() {
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    window.location.href = `${API_URL}/api/collected-data/export?api_key=${encodeURIComponent(apiKey)}`;
  }

  function parseData(data: string) {
    try { return JSON.parse(data); } catch { return {}; }
  }

  return (
    <div className="">
      <Toaster theme="dark" />

      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-widest mb-1">Analytics</p>
          <h1 className="text-2xl font-semibold text-text mb-1">Collected Data</h1>
          <p className="text-sm text-muted">Structured data captured from agent conversations</p>
        </div>
        {activeTab === "data" && records.length > 0 && (
          <Button variant="secondary" onClick={exportCSV}>Export CSV</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface p-1 rounded-xl border border-white/5 w-fit">
        {(["data", "schema"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === tab
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-text hover:bg-white/5"
            }`}
          >
            {tab === "data" ? "Collected Data" : "Schema Configuration"}
          </button>
        ))}
      </div>

      {activeTab === "data" && (
        <>
          {records.length === 0 ? (
            <Card>
              <CardBody style={{ textAlign: "center", padding: "48px 24px" }}>
                <p style={{ color: "var(--color-muted)", margin: "0 0 12px" }}>
                  No data collected yet. Configure a schema and enable data collection in Settings.
                </p>
                <Button variant="secondary" onClick={() => setActiveTab("schema")}>
                  Configure Schema
                </Button>
              </CardBody>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {records.map((rec) => {
                const data = parseData(rec.data);
                const isExpanded = expanded === rec.id;
                return (
                  <Card key={rec.id}>
                    <CardBody style={{ padding: "12px 20px" }}>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                        onClick={() => setExpanded(isExpanded ? null : rec.id)}
                      >
                        <Badge variant={rec.channel === "voice" ? "info" : rec.channel === "sms" ? "success" : "neutral"}>
                          {rec.channel.toUpperCase()}
                        </Badge>
                        <span style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
                          Call #{rec.call_log_id} · {new Date(rec.created_at).toLocaleString()}
                        </span>
                        <span style={{ color: "var(--color-accent-light)", fontSize: "0.8rem", marginLeft: "auto" }}>
                          {Object.keys(data).length} field{Object.keys(data).length !== 1 ? "s" : ""}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-muted)", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                          <path d="M7 10l5 5 5-5H7z" />
                        </svg>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                          {Object.entries(data).map(([k, v]) => (
                            <div key={k} style={{ background: "var(--color-surface-2)", borderRadius: 8, padding: "8px 12px" }}>
                              <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</p>
                              <p style={{ margin: "2px 0 0", fontSize: "0.875rem", color: "var(--color-text)" }}>{String(v)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "schema" && (
        <Card>
          <CardHeader>
            <span style={{ fontWeight: 600, color: "var(--color-text)" }}>Collection Schema</span>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-muted)" }}>
              Define what data the agent should collect during conversations
            </p>
          </CardHeader>
          <CardBody>
            {schema.length === 0 && (
              <p style={{ color: "var(--color-muted)", margin: "0 0 16px", fontSize: "0.875rem" }}>
                Add fields to start collecting structured data from conversations.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {schema.map((field, i) => (
                <div
                  key={i}
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto", gap: 10, alignItems: "end" }}
                >
                  <Input
                    label={i === 0 ? "Field Name" : undefined}
                    placeholder="e.g. customer_email"
                    value={field.name}
                    onChange={(e) => updateField(i, { name: e.target.value })}
                  />
                  <Input
                    label={i === 0 ? "Label (shown to agent)" : undefined}
                    placeholder="e.g. Customer Email"
                    value={field.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                  />
                  <div>
                    {i === 0 && <label style={{ fontSize: "0.8rem", color: "var(--color-muted)", fontWeight: 500, display: "block", marginBottom: 5 }}>Type</label>}
                    <select
                      value={field.type}
                      onChange={(e) => updateField(i, { type: e.target.value })}
                      style={{ padding: "9px 10px", background: "var(--color-surface-2)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, color: "var(--color-text)", fontSize: "0.875rem" }}
                    >
                      {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", paddingBottom: 2 }}>
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(i, { required: e.target.checked })}
                    />
                    <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                      {i === 0 ? "Required" : "Req."}
                    </span>
                  </label>
                  <Button variant="danger" size="sm" onClick={() => removeField(i)}>✕</Button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" size="sm" onClick={addField}>+ Add Field</Button>
              <Button size="sm" onClick={saveSchema} loading={saving}>Save Schema</Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
