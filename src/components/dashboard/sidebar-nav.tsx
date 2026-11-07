"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/dashboard/nav-items";

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex-1 px-3 py-5">
      <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Workspace</p>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${active ? "bg-white text-[#153c32] shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-[#e7f2ed] text-[#245c4b]" : "bg-white/[0.06] text-white/55 group-hover:text-white"}`}><Icon className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" /></span>
                {label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#398c6f]" aria-hidden="true" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
