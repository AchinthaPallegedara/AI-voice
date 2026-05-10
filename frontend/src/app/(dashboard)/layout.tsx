import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SidebarNav } from "@/components/SidebarNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <SidebarNav orgName={session.orgName} />
      <main style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>{children}</main>
    </div>
  );
}
