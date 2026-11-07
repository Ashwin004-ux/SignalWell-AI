"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { AlertCircle, ArrowRight, Mail } from "lucide-react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`
    });

    setLoading(false);

    if (resetError) {
      setError("We couldn't send a reset link right now. Try again in a moment.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell eyebrow="Password recovery" title="Check your email" description={`If an account exists for ${email}, we sent a secure link to reset your password.`}>
        <div className="rounded-xl border border-[#dce9e0] bg-[#f5faf6] p-4 text-sm leading-6 text-slate-600">Open the link in your email to choose a new password. You can close this page after the message arrives.</div>
        <p className="mt-5 text-center text-sm"><Link href="/login" className="font-semibold text-[#2d684f] hover:text-[#19372f]">Back to sign in</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Password recovery" title="Reset your password" description="Enter the email address linked to your account and we’ll send you a secure reset link.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400" />
          </div>
        </div>

        {error && <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

        <Button type="submit" disabled={loading} className="mt-1 h-12 w-full">
          {loading ? "Sending…" : <>Send reset link <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </form>
      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm"><Link href="/login" className="font-semibold text-[#2d684f] hover:text-[#19372f]">Back to sign in</Link></p>
    </AuthShell>
  );
}
