"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast, Toaster } from "sonner";

interface KnowledgeEntry {
  id: number;
  type: string;
  title: string;
  content: string;
  tags: string;
  active: boolean;
  sort_order: number;
}

const typeColors: Record<string, "info" | "success" | "warning"> = {
  faq: "info",
  doc: "neutral" as "info",
  product: "success",
};

const emptyEntry = (): Omit<KnowledgeEntry, "id"> => ({
  type: "faq",
  title: "",
  content: "",
  tags: "",
  active: true,
  sort_order: 0,
});

export function KnowledgePage({
  initialEntries,
  apiKey,
}: {
  initialEntries: KnowledgeEntry[];
  apiKey: string;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [filter, setFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [form, setForm] = useState(emptyEntry());
  const [saving, setSaving] = useState(false);

  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.type === filter);

  function openCreate() {
    setEditing(null);
    setForm(emptyEntry());
    setModalOpen(true);
  }

  function openEdit(e: KnowledgeEntry) {
    setEditing(e);
    setForm({ type: e.type, title: e.title, content: e.content, tags: e.tags, active: e.active, sort_order: e.sort_order });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await apiFetch<KnowledgeEntry>(`/api/knowledge/${editing.id}`, apiKey, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        setEntries((prev) => prev.map((e) => (e.id === editing.id ? updated : e)));
        toast.success("Entry updated");
      } else {
        const created = await apiFetch<KnowledgeEntry>("/api/knowledge", apiKey, {
          method: "POST",
          body: JSON.stringify(form),
        });
        setEntries((prev) => [created, ...prev]);
        toast.success("Entry created");
      }
      setModalOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e: KnowledgeEntry) {
    if (!confirm(`Delete "${e.title}"?`)) return;
    try {
      await apiFetch(`/api/knowledge/${e.id}`, apiKey, { method: "DELETE" });
      setEntries((prev) => prev.filter((x) => x.id !== e.id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function toggleActive(e: KnowledgeEntry) {
    try {
      const updated = await apiFetch<KnowledgeEntry>(`/api/knowledge/${e.id}`, apiKey, {
        method: "PUT",
        body: JSON.stringify({ ...e, active: !e.active }),
      });
      setEntries((prev) => prev.map((x) => (x.id === e.id ? updated : x)));
    } catch {
      toast.error("Failed to update");
    }
  }

  const tabs = ["all", "faq", "doc", "product"];

  return (
    <div className="">
      <Toaster theme="dark" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-widest mb-1">Knowledge</p>
          <h1 className="text-2xl font-semibold text-text mb-1">Knowledge Base</h1>
          <p className="text-sm text-muted">Business knowledge injected into every agent conversation</p>
        </div>
        <Button onClick={openCreate} icon={<span className="text-base leading-none">+</span>}>
          Add Entry
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-5 bg-surface p-1 rounded-xl border border-white/5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filter === tab
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-text hover:bg-white/5"
            }`}
          >
            {tab === "all" ? "All" : tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <Card>
          <CardBody style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ color: "var(--color-muted)", margin: "0 0 16px" }}>
              No knowledge entries yet. Add your first one to make the agent smarter.
            </p>
            <Button onClick={openCreate}>Add Entry</Button>
          </CardBody>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((entry) => (
            <Card key={entry.id}>
              <CardBody style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <Badge variant={entry.type === "product" ? "success" : entry.type === "faq" ? "info" : "neutral"}>
                        {entry.type.toUpperCase()}
                      </Badge>
                      <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "0.9rem" }}>
                        {entry.title}
                      </span>
                      {!entry.active && (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                    </div>
                    <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 600 }}>
                      {entry.content}
                    </p>
                    {entry.tags && (
                      <p style={{ margin: "4px 0 0", color: "var(--color-accent-light)", fontSize: "0.75rem" }}>
                        {entry.tags}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(entry)}>
                      {entry.active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(entry)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(entry)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Entry" : "Add Knowledge Entry"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Save Changes" : "Add Entry"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--color-muted)", fontWeight: 500, display: "block", marginBottom: 5 }}>
              Type
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", background: "var(--color-surface-2)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, color: "var(--color-text)", fontSize: "0.875rem" }}
            >
              <option value="faq">FAQ</option>
              <option value="doc">Document</option>
              <option value="product">Product</option>
            </select>
          </div>

          <Input
            label="Title"
            placeholder="e.g. Refund Policy"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />

          <Textarea
            label="Content"
            placeholder="Enter the knowledge content here..."
            rows={5}
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          />

          <Input
            label="Tags (optional, comma-separated)"
            placeholder="e.g. billing, support, refund"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>Active (injected into agent)</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
