import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#f4f7f5] md:grid md:grid-cols-[252px_1fr]">
      <aside className="hidden border-r border-white/5 bg-[#122820] md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d9eee4] text-[#245b49]"><span className="text-xl font-bold">S</span></span>
          <span><span className="block font-serif text-base font-semibold tracking-tight text-white">SignalWell</span><span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">Digital wellbeing</span></span>
        </Link>
        <SidebarNav />
        <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/[0.05] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Your data, your choice</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/65">Tracking is opt-in. Pause it whenever you need.</p>
        </div>
        <div className="border-t border-white/10 px-5 py-4">
          <p className="truncate text-xs text-white/60">{user?.email}</p>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <MobileNav userEmail={user?.email ?? ""} />
        <DashboardTopbar />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-9">{children}</main>
      </div>
    </div>
  );
}
