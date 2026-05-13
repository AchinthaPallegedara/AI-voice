import { getSession } from "@/lib/session";
import Link from "next/link";
import { Phone, Settings, ArrowUpRight, Zap, BookOpen, Mic } from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();

  return (
    <div className="">
      {/* Page header */}
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-text mb-1">Dashboard</h1>
        <p className="text-sm text-muted">
          Welcome back,{" "}
          <span className="text-accent-light font-medium">{session?.orgName}</span>
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <QuickCard
          href="/dashboard/call"
          title="Start a Call"
          description="Launch a live voice conversation with your AI agent."
          iconBg="rgba(63,185,80,0.1)"
          iconColor="#3fb950"
          Icon={Phone}
        />
        <QuickCard
          href="/dashboard/settings"
          title="Configure Agent"
          description="Set your AI's name, voice, and behaviour."
          iconBg="rgba(47,129,247,0.12)"
          iconColor="#58a6ff"
          Icon={Settings}
        />
        <QuickCard
          href="/dashboard/knowledge"
          title="Knowledge Base"
          description="Add facts and FAQs the agent knows about your business."
          iconBg="rgba(210,153,34,0.12)"
          iconColor="#d29922"
          Icon={BookOpen}
        />
        <QuickCard
          href="/dashboard/recordings"
          title="Recordings"
          description="Review past calls with transcripts and audio playback."
          iconBg="rgba(248,81,73,0.1)"
          iconColor="#f85149"
          Icon={Mic}
        />
      </div>

      {/* Getting started */}
      <div className="bg-surface border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-3.5 h-3.5 text-accent-light" />
          <h2 className="text-xs font-semibold text-text uppercase tracking-wider">Getting started</h2>
        </div>
        <ol className="space-y-3.5">
          {[
            <>Go to <Link href="/dashboard/settings" className="text-accent-light hover:underline">Settings</Link> to give your AI a name and personality.</>,
            <>Head to <Link href="/dashboard/call" className="text-accent-light hover:underline">Voice Call</Link> and press the button to start talking.</>,
            <>Allow microphone access when prompted by your browser.</>,
          ].map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-muted">
              <span className="flex-shrink-0 w-5 h-5 rounded-md bg-surface-2 border border-white/10 text-xs flex items-center justify-center text-muted/70 font-medium mt-px">
                {i + 1}
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function QuickCard({
  href,
  title,
  description,
  Icon,
  iconBg,
  iconColor,
}: {
  href: string;
  title: string;
  description: string;
  Icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Link href={href} className="group block h-full">
      <div className="h-full bg-surface border border-white/10 rounded-xl p-4 transition-all hover:border-white/18 hover:bg-surface-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
          style={{ background: iconBg }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="flex items-start justify-between gap-1">
          <div>
            <p className="font-medium text-text text-[13px] mb-0.5">{title}</p>
            <p className="text-muted text-xs leading-relaxed">{description}</p>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0 mt-0.5" />
        </div>
      </div>
    </Link>
  );
}
