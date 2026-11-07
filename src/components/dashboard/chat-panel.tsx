"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  message: string;
}

export function ChatPanel({ initialMessages }: { initialMessages: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", message: text }]);
    setInput("");
    setSending(true);
    setError(null);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, message: text })
    });

    const body = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setError(body.error ?? "We couldn't get a response right now.");
      return;
    }

    setConversationId(body.conversation_id);
    setMessages((prev) => [...prev, { role: "assistant", message: body.message }]);
  }

  return (
    <div className="flex h-[70vh] flex-col rounded border border-slate-200 bg-white">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">
            Ask something like "why has my browser usage gone up this week?" or "how can I improve my sleep?"
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[80%] rounded px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-signal-500 text-white"
                    : "mr-auto bg-slate-100 text-ink"
                }`}
              >
                {m.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="border-t border-slate-100 px-4 py-2 text-sm text-elevated">
          {error}
        </p>
      )}

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-200 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask SignalWell Assistant…"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-signal-500"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send message"
          className="rounded bg-signal-500 p-2 text-white disabled:bg-slate-300"
        >
          <Send className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
