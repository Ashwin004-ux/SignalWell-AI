"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS } from "@/components/dashboard/nav-items";
import { LogoutButton } from "@/components/dashboard/logout-button";

export function MobileNav({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200 bg-white md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e4f0e9] text-sm font-bold text-[#245b49]">S</span>
          <span className="font-serif text-base font-semibold text-[#19372f]">SignalWell</span>
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-slate-200 px-3 py-3">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${pathname === href ? "bg-[#eaf3ee] text-[#245b49]" : "text-slate-600 hover:bg-slate-100 hover:text-ink"}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-slate-200 px-3 pt-3">
            <p className="truncate text-xs text-slate-500">{userEmail}</p>
            <LogoutButton />
          </div>
        </nav>
      )}
    </div>
  );
}
