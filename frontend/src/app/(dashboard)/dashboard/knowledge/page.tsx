import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { KnowledgePage } from "./KnowledgePage";
import { redirect } from "next/navigation";

interface KnowledgeEntry {
  id: number;
  type: string;
  title: string;
  content: string;
  tags: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  let entries: KnowledgeEntry[] = [];
  try {
    entries = await apiFetch<KnowledgeEntry[]>("/api/knowledge", session.apiKey, { cache: "no-store" });
  } catch {
    entries = [];
  }

  return <KnowledgePage initialEntries={entries} apiKey={session.apiKey} />;
}
