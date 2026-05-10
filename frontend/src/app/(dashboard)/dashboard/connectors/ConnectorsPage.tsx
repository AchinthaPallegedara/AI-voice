"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast, Toaster } from "sonner";
import type { APIConnector } from "./page";

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

export function ConnectorsPage({
  initialConnectors,
  apiKey,
}: {
  initialConnectors: APIConnector[];
  apiKey: string;
}) {
  const [connectors, setConnectors] = useState(initialConnectors);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<APIConnector | null>(null);
  const [form, setForm] = useState(emptyConnector());
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testParams, setTestParams] = useState("{}");
  const [testing, setTesting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(emptyConnector());
    setTestResult(null);
    setTestParams("{}");
    setModalOpen(true);
  }

  function openEdit(c: APIConnector) {
    setEditing(c);
    setForm({ name: c.name, description: c.description, base_url: c.base_url, method: c.method, path_template: c.path_template, headers: c.headers || "{}", body_template: c.body_template, params_schema: c.params_schema, active: c.active });
    setTestResult(null);
    setTestParams("{}");
    setModalOpen(true);
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
      setModalOpen(false);
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

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <Toaster theme="dark" />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--color-text)" }}>
            API Connectors
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--color-muted)", fontSize: "0.875rem" }}>
            External APIs the agent can call during conversations using function calling
          </p>
        </div>
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
                  <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "0.9rem" }}>{c.name}</span>
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

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? `Edit: ${editing.name}` : "Add API Connector"}
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
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

          <Textarea
            label="Description (shown to the agent)"
            placeholder="e.g. Look up a customer by phone number"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          <Input
            label="Base URL"
            placeholder="https://api.yourcrm.com"
            value={form.base_url}
            onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
          />

          <Input
            label="Path Template"
            placeholder="/customers/{phone}"
            hint="Use {param} placeholders matching your params schema"
            value={form.path_template}
            onChange={(e) => setForm((f) => ({ ...f, path_template: e.target.value }))}
          />

          <Textarea
            label="Headers (JSON)"
            placeholder='{"Authorization": "Bearer YOUR_TOKEN"}'
            rows={2}
            value={form.headers}
            onChange={(e) => setForm((f) => ({ ...f, headers: e.target.value }))}
          />

          <Textarea
            label="Parameters Schema (JSON Schema)"
            placeholder='{"type":"object","properties":{"phone":{"type":"string","description":"Customer phone"}}}'
            rows={4}
            value={form.params_schema}
            onChange={(e) => setForm((f) => ({ ...f, params_schema: e.target.value }))}
          />

          {editing && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 14 }}>
              <Textarea
                label="Test Parameters (JSON)"
                rows={2}
                value={testParams}
                onChange={(e) => setTestParams(e.target.value)}
              />
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
    </div>
  );
}
