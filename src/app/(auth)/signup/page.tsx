"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { AlertCircle, ArrowRight, KeyRound, Mail, UserRound } from "lucide-react";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      }
    });

    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.includes("already registered")
          ? "An account with this email already exists. Try logging in instead."
          : "We couldn't create your account. Check your details and try again."
      );
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthShell eyebrow="One last step" title="Check your email" description="We sent a confirmation link to your inbox. Confirm your email to finish creating your account.">
        <div className="rounded-xl border border-[#dce9e0] bg-[#f5faf6] p-4">
          <p className="break-all text-sm font-semibold text-[#245b49]">{email}</p>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">If it doesn’t arrive soon, check your spam folder.</p>
        </div>
        <p className="mt-5 text-center text-sm text-slate-500">Already confirmed? <Link href="/login" className="font-semibold text-[#2d684f] hover:text-[#19372f]">Sign in</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Get started" title="Create your account" description="A personal space to connect your digital habits with the wellbeing signals you choose to track.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-sm font-semibold text-slate-700">Full name</label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="fullName" type="text" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="h-12 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400" />
          </div>
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400" />
          </div>
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" className="h-12 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400" />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Use at least 8 characters.</p>
        </div>

        {error && <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

        <Button type="submit" disabled={loading} className="mt-1 h-12 w-full">
          {loading ? "Creating account…" : <>Create account <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs leading-5 text-slate-400">By creating an account, you agree to our <Link href="/terms" className="underline underline-offset-2 hover:text-slate-600">Terms</Link> and <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-slate-600">Privacy Policy</Link>.</p>
      <div className="mt-5 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-semibold text-[#2d684f] hover:text-[#19372f]">Sign in</Link></div>
    </AuthShell>
  );
}
