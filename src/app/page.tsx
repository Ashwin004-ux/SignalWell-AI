import Link from "next/link";
import { Activity, Moon, MessageSquare, ShieldCheck, Puzzle, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeading } from "@/components/ui/card";

const MEASURES = [
  { icon: Activity, label: "Browser usage & app categories", detail: "Time in your browser, category breakdown, and app switching frequency." },
  { icon: LineChart, label: "Social media usage", detail: "Time spent, separated from other categories of app use." },
  { icon: Moon, label: "Sleep duration & patterns", detail: "Start and end times, duration, quality, and interruptions." },
  { icon: MessageSquare, label: "Mood, stress & anxiety", detail: "Short daily self-reports you enter yourself." }
];

const FAQS = [
  {
    q: "Does SignalWell diagnose mental health conditions?",
    a: "No. SignalWell identifies patterns in your data and produces wellbeing indicators — stable, monitor, or elevated — not clinical diagnoses. It is not a substitute for a qualified mental health professional."
  },
  {
    q: "How does the extension collect data?",
    a: "The browser extension records domain-level usage (which sites, how long, and when) using Chrome's Manifest V3 APIs. It does not read page contents, form data, or messages."
  },
  {
    q: "Can SignalWell read my screen time on my phone or laptop OS?",
    a: "Not directly — a website cannot access operating-system-level screen time. Today, SignalWell measures browser activity through the extension and whatever you choose to log yourself. Device-level integration is planned as a separate, explicitly-permissioned component."
  },
  {
    q: "Who can see my data?",
    a: "Only you. Every table in the database is isolated with Supabase Row Level Security, so no other user or generic backend process can query your rows."
  }
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
      <nav className="sticky top-0 z-20 -mx-5 mb-10 flex items-center justify-between border-b border-[#e3eae5]/80 bg-[#f4f7f5]/90 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#dceee4] text-[#245b49]"><Activity className="h-5 w-5" /></span>
          <span className="font-serif text-lg font-semibold tracking-tight text-[#19372f]">SignalWell <span className="text-[#668273]">AI</span></span>
        </Link>
        <div className="flex items-center gap-3 text-sm sm:gap-6">
          <a href="#how-it-works" className="hidden text-slate-600 hover:text-ink sm:inline">How it works</a>
          <a href="#privacy" className="hidden text-slate-600 hover:text-ink sm:inline">Privacy</a>
          <Link href="/login" className="hidden text-slate-600 hover:text-ink sm:inline">Log in</Link>
          <Link href="/signup">
            <Button className="whitespace-nowrap px-3 sm:px-4">Create account</Button>
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden rounded-[28px] border border-[#dbe7df] bg-white p-6 shadow-[0_20px_70px_rgba(24,57,43,0.08)] sm:p-10 lg:p-14">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#edf5ef] blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center lg:gap-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d9e8de] bg-[#f3f8f4] px-3 py-1.5 text-xs font-semibold text-[#356650]"><span className="h-1.5 w-1.5 rounded-full bg-[#4d9773]" />A clearer view of your digital wellbeing</div>
          <h1 className="max-w-[17ch] font-serif text-4xl leading-[1.08] tracking-[-0.035em] text-[#19372f] md:text-5xl lg:text-6xl">
            Understand how your digital habits connect with your wellbeing.
          </h1>
          <p className="mt-5 max-w-prose text-base leading-7 text-slate-600 sm:text-lg">
            SignalWell AI records your browser usage, sleep, and self-reported mood side by side,
            then shows you where they move together — so you can see the pattern, not just the numbers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup">
              <Button className="px-6 py-3">Create your account</Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="secondary" className="px-6 py-3">See how it works</Button>
            </a>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#4d8067]" /> Privacy-first by design</span><span className="inline-flex items-center gap-1.5"><Activity className="h-4 w-4 text-[#4d8067]" /> Daily patterns, not diagnoses</span></div>
          <p className="mt-5 max-w-prose text-xs leading-5 text-slate-400">
            SignalWell AI is a wellbeing and research tool. It does not diagnose depression, anxiety, or
            other mental illnesses, and it is not a substitute for professional care.
          </p>
        </div>
        <div className="relative rounded-2xl border border-[#e3ebe5] bg-[#fbfcfb] p-5 shadow-[0_12px_36px_rgba(24,57,43,0.07)] sm:p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div><p className="text-sm font-semibold text-[#19372f]">Your wellbeing signals</p><p className="mt-1 text-xs text-slate-500">Example dashboard preview</p></div><span className="rounded-full bg-[#eaf3ed] px-2.5 py-1 text-[10px] font-semibold text-[#356650]">DAILY VIEW</span></div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[{label:"Browser usage",value:"3h 24m",change:"−8%",color:"#43856b"},{label:"Sleep",value:"7h 12m",change:"+24m",color:"#718b7c"},{label:"Mood",value:"7.4 / 10",change:"steady",color:"#b8862e"}].map((metric)=><div key={metric.label} className="rounded-xl border border-slate-100 bg-white p-3"><p className="text-[10px] font-medium text-slate-500">{metric.label}</p><p className="mt-2 text-sm font-semibold tracking-tight text-[#19372f]">{metric.value}</p><p className="mt-1 text-[10px] font-medium" style={{color:metric.color}}>{metric.change}</p></div>)}
          </div>
          <div className="mt-5 rounded-xl border border-slate-100 bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#19372f]">Patterns over the week</p><p className="text-[10px] text-slate-400">Illustrative preview</p></div><div className="mt-4 flex h-28 items-end gap-2">{[38,54,44,70,60,78,64].map((height,index)=><div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-gradient-to-t from-[#4d8067] to-[#8bb59b]" style={{height:`${height}%`,opacity:0.62+index*0.04}} /><span className="text-[9px] text-slate-400">{["M","T","W","T","F","S","S"][index]}</span></div>)}</div><div className="mt-2 flex items-start gap-2 rounded-lg bg-[#f4f8f5] p-3"><span className="mt-0.5 h-2 w-2 rounded-full bg-[#6b9a7e]"/><p className="text-[11px] leading-4 text-slate-600">Connect activity, sleep, and mood to notice how your own patterns change.</p></div></div>
          <p className="mt-4 text-center text-[10px] text-slate-400">Example interface only · no sample readings are presented as real user data</p>
        </div>
        </div>
      </section>

      <section id="how-it-works" className="mt-24 rounded-2xl border border-[#e2eae4] bg-white p-7 sm:p-9">
        <h2 className="font-serif text-2xl text-ink">How SignalWell works</h2>
        <ol className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
          <li className="rounded border border-slate-200 bg-white p-4">
            <p className="font-medium text-ink">1. Collect</p>
            <p className="mt-1">The extension records browser activity; you log sleep and mood.</p>
          </li>
          <li className="rounded border border-slate-200 bg-white p-4">
            <p className="font-medium text-ink">2. Aggregate</p>
            <p className="mt-1">Each day's activity is summarized into consistent daily figures.</p>
          </li>
          <li className="rounded border border-slate-200 bg-white p-4">
            <p className="font-medium text-ink">3. Analyze</p>
            <p className="mt-1">An AI layer looks for relationships across your recent history.</p>
          </li>
          <li className="rounded border border-slate-200 bg-white p-4">
            <p className="font-medium text-ink">4. Reflect</p>
            <p className="mt-1">You see plain-language insights and suggestions, not a diagnosis.</p>
          </li>
        </ol>
      </section>

      <section className="mt-20">
        <h2 className="font-serif text-2xl text-ink">What SignalWell measures</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {MEASURES.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(20,45,35,0.035)] transition-all hover:-translate-y-0.5 hover:border-[#cadbd0] hover:shadow-md">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-signal-500" strokeWidth={1.75} aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="mt-1 text-sm text-slate-500">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_2px_12px_rgba(20,45,35,0.035)]">
          <MessageSquare className="h-5 w-5 text-signal-500" strokeWidth={1.75} aria-hidden="true" />
          <h3 className="mt-3 font-serif text-lg text-ink">AI insights, written plainly</h3>
          <p className="mt-2 text-sm text-slate-600">
            Instead of a verdict, SignalWell describes what changed and what it might relate to — for
            example, noting that late-night usage rose in the same week reported sleep duration fell —
            and separates what was observed from what the AI is inferring.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_2px_12px_rgba(20,45,35,0.035)]">
          <Puzzle className="h-5 w-5 text-signal-500" strokeWidth={1.75} aria-hidden="true" />
          <h3 className="mt-3 font-serif text-lg text-ink">SignalWell Assistant</h3>
          <p className="mt-2 text-sm text-slate-600">
            Ask about your own data in plain language — "why has my browser usage gone up this week?" —
            and get an answer grounded in your actual activity, not a generic response.
          </p>
        </div>
      </section>

      <section id="privacy" className="mt-20 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_2px_12px_rgba(20,45,35,0.035)] sm:p-9">
        <ShieldCheck className="h-5 w-5 text-signal-500" strokeWidth={1.75} aria-hidden="true" />
        <h2 className="mt-3 font-serif text-2xl text-ink">Privacy</h2>
        <p className="mt-2 max-w-prose text-sm text-slate-600">
          Every table in the database is isolated per user with Supabase Row Level Security. You can turn
          off data collection, disable the chatbot's access to your activity data, export everything, or
          delete your account from Privacy &amp; Data settings at any time.
        </p>
        <div className="mt-4 flex gap-4 text-sm">
          <Link href="/privacy-policy" className="text-signal-600 underline underline-offset-2">Privacy Policy</Link>
          <Link href="/terms" className="text-signal-600 underline underline-offset-2">Terms &amp; Conditions</Link>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-serif text-2xl text-ink">The extension</h2>
        <p className="mt-2 max-w-prose text-sm text-slate-600">
          A Manifest V3 browser extension records which domains you visit and for how long, including
          social media and late-night use. It never reads page contents, keystrokes, form data, or
          messages. You can pause tracking at any time from the extension popup.
        </p>
      </section>

      <section className="mt-20">
        <h2 className="font-serif text-2xl text-ink">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {FAQS.map(({ q, a }) => (
            <div key={q} className="p-5">
              <p className="text-sm font-medium text-ink">{q}</p>
              <p className="mt-2 text-sm text-slate-600">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 rounded-[28px] border border-[#dbe7df] bg-[#eaf2ec] p-8 text-center sm:p-12">
        <h2 className="font-serif text-2xl text-ink">Start seeing the pattern</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm text-slate-600">
          Create an account, connect the extension, and log your first mood entry. Most people need a
          few days of data before the first analysis is meaningful.
        </p>
        <Link href="/signup" className="mt-5 inline-block">
          <Button className="px-6 py-3">Create your account</Button>
        </Link>
      </section>

      <footer className="mt-24 flex flex-col gap-2 border-t border-slate-200 py-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} SignalWell AI. Not a medical diagnostic system.</p>
        <div className="flex gap-4">
          <Link href="/privacy-policy" className="hover:text-slate-600">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-slate-600">Terms</Link>
        </div>
      </footer>
    </main>
  );
}
