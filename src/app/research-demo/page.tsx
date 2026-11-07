import Link from "next/link";
import { ResearchDemoDashboard } from "@/components/research-demo-dashboard";

export const metadata = {
  title: "Research Demo",
  description: "Explore isolated synthetic SignalWell observations and supported analysis."
};

export default function ResearchDemoPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="font-serif text-lg font-semibold text-ink">SignalWell AI</Link>
          <Link href="/login" className="text-sm text-slate-600 hover:text-ink">Sign in</Link>
        </div>
      </header>
      <ResearchDemoDashboard />
    </div>
  );
}
