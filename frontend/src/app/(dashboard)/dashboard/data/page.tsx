import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { DataPage } from "./DataPage";
import { redirect } from "next/navigation";

export interface FieldDef {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

export interface CollectedRecord {
  id: number;
  call_log_id: number;
  channel: string;
  data: string;
  created_at: string;
}

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  let schema: FieldDef[] = [];
  let records: CollectedRecord[] = [];

  try {
    schema = await apiFetch<FieldDef[]>("/api/data-schema", session.apiKey, { cache: "no-store" });
  } catch { /* no schema yet */ }

  try {
    records = await apiFetch<CollectedRecord[]>("/api/collected-data", session.apiKey, { cache: "no-store" });
  } catch { /* empty */ }

  return <DataPage initialSchema={schema || []} initialRecords={records || []} apiKey={session.apiKey} />;
}
