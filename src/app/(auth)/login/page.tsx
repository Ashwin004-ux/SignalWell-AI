"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { AlertCircle, ArrowRight, KeyRound, Mail } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError("We couldn't sign you in. Check your email and password and try again.");
      return;
    }

    const redirectedFrom = searchParams.get("redirectedFrom") ?? "/dashboard";
    router.push(redirectedFrom);
    router.refresh();
  }

  return (
    <AuthShell eyebrow="Welcome back" title="Sign in" description="Pick up where you left off and review your personal wellbeing patterns.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400" />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">Password</label>
            <Link href="/reset-password" className="text-xs font-semibold text-[#397459] hover:text-[#245b49]">Forgot password?</Link>
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="h-12 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400" />
          </div>
        </div>

        {error && <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

        <Button type="submit" disabled={loading} className="mt-1 h-12 w-full">
          {loading ? "Signing in…" : <>Sign in <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
        New to SignalWell? <Link href="/signup" className="font-semibold text-[#2d684f] hover:text-[#19372f]">Create an account</Link>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
