"use client"

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/dashboard/nav-items";
import { ChevronRight, Sparkles } from "lucide-react";

export function DashboardTopbar() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find(({ href }) => href === pathname || (href !== "/dashboard" && pathname.startsWith(`${href}/`)));
  return (
    <header className="hidden h-[68px] items-center justify-between border-b border-slate-200/80 bg-white/80 px-8 backdrop-blur-xl md:flex">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Workspace</span><ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" /><span className="font-semibold text-[#19372f]">{current?.label || "Overview"}</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-[#dce9e2] bg-[#f5faf7] px-3 py-1.5 text-xs font-medium text-[#336a57]">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> A little more awareness, every day
      </div>
    </header>
  );
}
