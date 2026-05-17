import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { TwilioChannelForm } from "@/components/TwilioChannelForm";

interface TwilioChannel {
  account_sid: string;
  auth_token: string;
  phone_number: string;
  active: boolean;
}

export default async function ChannelsPage() {
  const session = await getSession();
  if (!session) return null;

  let channel: TwilioChannel | null = null;
  try {
    channel = await apiFetch<TwilioChannel>("/api/twilio-channel", session.apiKey, {
      cache: "no-store",
    });
  } catch {
    /* not configured yet */
  }

  const webhookBase = process.env.NEXT_PUBLIC_API_URL ?? "https://your-server.com";
  const voiceWebhookUrl = `${webhookBase}/webhook/${session.apiKey}/twilio/voice`;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-text mb-1">Channels</h1>
        <p className="text-sm text-muted">
          Connect Twilio to receive inbound phone calls routed to your AI voice agent.
        </p>
      </div>
      <TwilioChannelForm
        apiKey={session.apiKey}
        initial={channel}
        voiceWebhookUrl={voiceWebhookUrl}
      />
    </div>
  );
}
