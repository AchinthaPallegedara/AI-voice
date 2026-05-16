import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SidebarNav } from "@/components/SidebarNav";
import { apiFetch } from "@/lib/api";

export interface UsageStats {
  used_secs: number;
  used_mins: number;
  plan: string;
  plan_limit_mins: number;
  period_start: string;
}

async function fetchUsage(apiKey: string): Promise<UsageStats | null> {
  try {
    return await apiFetch<UsageStats>("/api/usage", apiKey);
  } catch {
    return null;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const usage = await fetchUsage(session.apiKey);

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <SidebarNav orgName={session.orgName} usage={usage} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-7 ">{children}</div>
      </main>
    </div>
  );
}
