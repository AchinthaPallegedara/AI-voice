import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SidebarNav } from "@/components/SidebarNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <SidebarNav orgName={session.orgName} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-7 ">{children}</div>
      </main>
    </div>
  );
}
