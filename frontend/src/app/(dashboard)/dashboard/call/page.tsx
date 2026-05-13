import { getSession } from "@/lib/session";
import { VoiceCall } from "@/components/VoiceCall";

export default async function CallPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-text mb-1">Voice Call</h1>
        <p className="text-sm text-muted">Talk live with your AI voice agent.</p>
      </div>

      <div className="bg-surface border border-white/10 rounded-xl p-8">
        <VoiceCall apiKey={session.apiKey} />
      </div>
    </div>
  );
}
