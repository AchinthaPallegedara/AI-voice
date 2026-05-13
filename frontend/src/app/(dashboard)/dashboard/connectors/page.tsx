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

export interface WhatsAppChannel {
  id: number;
  phone_number_id: string;
  access_token: string;
  app_secret: string;
  verify_token: string;
  display_name: string;
  active: boolean;
}

export interface TelegramChannel {
  id: number;
  bot_token: string;
  bot_username: string;
  webhook_secret: string;
  active: boolean;
}

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [connectors, whatsappChannel, telegramChannel] = await Promise.all([
    apiFetch<APIConnector[]>("/api/connectors", session.apiKey, { cache: "no-store" }).catch(() => [] as APIConnector[]),
    apiFetch<WhatsAppChannel | null>("/api/whatsapp-channel", session.apiKey, { cache: "no-store" }).catch(() => null),
    apiFetch<TelegramChannel | null>("/api/telegram-channel", session.apiKey, { cache: "no-store" }).catch(() => null),
  ]);

  return (
    <ConnectorsPage
      initialConnectors={connectors}
      initialWhatsAppChannel={whatsappChannel}
      initialTelegramChannel={telegramChannel}
      apiKey={session.apiKey}
    />
  );
}
