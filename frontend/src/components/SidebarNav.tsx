"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Phone,
  BookOpen,
  Cable,
  Database,
  Mic,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",             label: "Dashboard",     icon: LayoutDashboard },
  { href: "/dashboard/call",        label: "Voice Call",    icon: Phone           },
  { href: "/dashboard/knowledge",   label: "Knowledge",     icon: BookOpen        },
  { href: "/dashboard/connectors",  label: "Connectors",    icon: Cable           },
  { href: "/dashboard/data",        label: "Collected Data",icon: Database        },
  { href: "/dashboard/recordings",  label: "Recordings",    icon: Mic             },
  { href: "/dashboard/settings",    label: "Settings",      icon: Settings        },
];

export function SidebarNav({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-[216px] flex-shrink-0 flex flex-col bg-surface border-r border-white/8 h-full">
      {/* Brand */}
      <div className="px-4 h-14 flex items-center gap-3 border-b border-white/8">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 shadow-sm shadow-accent/30">
          <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text truncate leading-tight">{orgName}</p>
          <p className="text-[11px] text-muted leading-tight">Voice Agent</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 flex flex-col gap-px overflow-y-auto">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-widest px-2 py-2 mt-1">
          Menu
        </p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all",
                active
                  ? "bg-accent/10 text-accent-light font-medium"
                  : "text-muted hover:bg-white/5 hover:text-text"
              )}
            >
              <Icon
                className={cn(
                  "w-[15px] h-[15px] flex-shrink-0 transition-colors",
                  active ? "text-accent-light" : "text-muted/70 group-hover:text-text"
                )}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-3 pt-2 border-t border-white/8">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-muted hover:bg-white/5 hover:text-text transition-all cursor-pointer"
        >
          <LogOut className="w-[15px] h-[15px] flex-shrink-0" strokeWidth={1.8} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
