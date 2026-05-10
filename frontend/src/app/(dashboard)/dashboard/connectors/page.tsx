import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { ConnectorsPage } from "./ConnectorsPage";
import { redirect } from "next/navigation";

export interface APIConnector {
  id: number;
  name: string;
  description: string;
  base_url: string;
  method: string;
  path_template: string;
  headers: string;
  body_template: string;
  params_schema: string;
  active: boolean;
}

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  let connectors: APIConnector[] = [];
  try {
    connectors = await apiFetch<APIConnector[]>("/api/connectors", session.apiKey, { cache: "no-store" });
  } catch {
    connectors = [];
  }

  return <ConnectorsPage initialConnectors={connectors} apiKey={session.apiKey} />;
}
