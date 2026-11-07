"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeading } from "@/components/ui/card";

type ReplyMode = "llm" | "computed_fallback" | "unavailable";
type ConversationMessage = { role: "user" | "assistant"; text: string; mode?: ReplyMode; note?: string };

export function ResearchDemoAssistant({ userId, days }: { userId: string; days: 7 | 30 }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || loading) return;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setError(null);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text: prompt }]);
    setLoading(true);
    try {
      const response = await fetch("/api/research-demo/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, days, question: prompt }),
        signal: nextController.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || result.error || "The demo assistant is unavailable.");
      setMessages((current) => [...current, {
        role: "assistant",
        text: result.reply,
        mode: result.assistant_mode,
        note: result.provider_note,
      }]);
    } catch (reason) {
      if (nextController.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "The demo assistant is unavailable.");
    } finally {
      if (controller.current === nextController) {
        controller.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <CardHeading>Research Demo Assistant</CardHeading>
        <p className="text-sm font-medium text-ink">Ask about {userId} · selected {days}-day window</p>
        <p className="text-xs text-slate-500">Context is restricted to this synthetic profile, its selected observations, calculated baselines and alerts, and actual available model results. The assistant does not read live-user or Supabase data.</p>
      </div>

      <div className="mt-4 space-y-3" aria-live="polite">
        {messages.map((message, index) => (
          <article key={index} className={message.role === "user" ? "ml-8 rounded border border-slate-200 bg-slate-50 p-3" : "mr-8 rounded border border-signal-500/30 bg-white p-3"}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {message.role === "user" ? "You" : message.mode === "llm" ? "AI answer · synthetic context" : message.mode === "computed_fallback" ? "Computed fallback · not an LLM" : "Assistant unavailable"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{message.text}</p>
            {message.note && <p className="mt-2 text-xs text-slate-500">{message.note}</p>}
          </article>
        ))}
        {loading && <p role="status" className="text-sm text-slate-500">Checking the selected synthetic observations…</p>}
        {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">Assistant unavailable: {error}</p>}
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="research-demo-question">Ask a question about this demo window</label>
        <input
          id="research-demo-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={2000}
          placeholder="Ask about stress, sleep, baselines, alerts, or the model…"
          className="h-10 min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 text-sm"
        />
        <Button type="submit" disabled={loading || !question.trim()}>{loading ? "Working…" : "Ask"}</Button>
      </form>
      {messages.length > 0 && <button type="button" onClick={() => setMessages([])} className="mt-2 text-xs text-slate-500 underline underline-offset-2">Clear this conversation</button>}
      <p className="mt-3 text-xs text-slate-500">Synthetic demonstration only. Answers describe recorded or calculated patterns; they do not establish causation or provide diagnosis or treatment.</p>
    </Card>
  );
}
