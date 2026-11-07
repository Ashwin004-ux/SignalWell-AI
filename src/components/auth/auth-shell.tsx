import Link from "next/link";
import { Activity, ArrowUpRight, Moon, ShieldCheck, Smile } from "lucide-react";
import type { ReactNode } from "react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f4f7f5] lg:grid lg:grid-cols-[minmax(390px,0.92fr)_1.08fr]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#122820] px-10 py-9 text-white lg:flex lg:flex-col xl:px-14">
        <div className="pointer-events-none absolute -right-40 top-24 h-[28rem] w-[28rem] rounded-full border border-white/[0.06]" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-20 top-44 h-[20rem] w-[20rem] rounded-full border border-white/[0.06]" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-40 -left-36 h-[30rem] w-[30rem] rounded-full bg-[#315f49]/35 blur-3xl" aria-hidden="true" />

        <Link href="/" className="relative flex w-fit items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dceee4] text-[#245b49]"><Activity className="h-5 w-5" strokeWidth={2} /></span>
          <span><span className="block font-serif text-lg font-semibold tracking-tight">SignalWell AI</span><span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">Digital wellbeing</span></span>
        </Link>

        <div className="relative my-auto max-w-xl py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-[#c5ddcf]"><span className="h-1.5 w-1.5 rounded-full bg-[#8ec5a2]" />A calmer way to see your patterns</span>
          <h2 className="mt-7 max-w-[12ch] font-serif text-4xl leading-[1.08] tracking-[-0.035em] xl:text-5xl">Small signals.<br />A clearer picture.</h2>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/65">Bring browser activity, sleep, and your own daily check-ins together. SignalWell helps you reflect on patterns without turning them into a diagnosis.</p>

          <div className="mt-10 grid gap-3">
            {[
              { icon: Activity, title: "Browser activity", note: "Opt-in, domain-level tracking" },
              { icon: Moon, title: "Sleep and mood", note: "Your own daily records" },
              { icon: Smile, title: "Personal patterns", note: "Context for reflection" },
            ].map(({ icon: Icon, title: itemTitle, note }) => (
              <div key={itemTitle} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.045] p-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.08] text-[#b8d8c3]"><Icon className="h-4 w-4" strokeWidth={1.8} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-white/90">{itemTitle}</span><span className="mt-0.5 block text-xs text-white/50">{note}</span></span>
                <ArrowUpRight className="h-4 w-4 text-white/25" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 border-t border-white/10 pt-5 text-xs leading-5 text-white/45">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#a6c9b1]" />
          <span>Your wellbeing data stays yours. SignalWell is not a medical service.</span>
        </div>
      </aside>

      <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 sm:py-12">
        <div className="w-full max-w-[440px]">
          <Link href="/" className="mb-6 inline-flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#dceee4] text-[#245b49]"><Activity className="h-5 w-5" /></span>
            <span className="font-serif text-lg font-semibold text-[#19372f]">SignalWell AI</span>
          </Link>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_50px_rgba(20,45,35,0.07)] sm:rounded-3xl sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#52816a]">{eyebrow}</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.03em] text-[#19372f]">{title}</h1>
            {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
            <div className="mt-7">{children}</div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-3 text-xs text-slate-400">
            <Link href="/terms" className="transition-colors hover:text-slate-600">Terms</Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacy-policy" className="transition-colors hover:text-slate-600">Privacy</Link>
            <span aria-hidden="true">·</span>
            <span>Not a medical service</span>
          </div>
        </div>
      </section>
    </main>
  );
}
