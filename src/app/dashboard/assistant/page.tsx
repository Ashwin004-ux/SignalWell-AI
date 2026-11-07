import { createClient } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/dashboard/chat-panel";

export default async function AssistantPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("chatbot_enabled")
    .eq("user_id", user.id)
    .single();

  const { data: lastConversation } = await supabase
    .from("chatbot_conversations")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let initialMessages: { role: "user" | "assistant"; message: string }[] = [];
  if (lastConversation) {
    const { data: messages } = await supabase
      .from("chatbot_messages")
      .select("role, message")
      .eq("conversation_id", lastConversation.id)
      .order("created_at", { ascending: true });
    initialMessages = (messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", message: m.message }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">SignalWell Assistant</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask about your own data. The assistant is conversational, not a therapist, and will not diagnose.
        </p>
      </div>

      {settings?.chatbot_enabled === false ? (
        <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          The assistant is turned off. Enable it from{" "}
          <a href="/dashboard/privacy" className="text-signal-600 underline underline-offset-2">
            Privacy &amp; Data
          </a>
          .
        </div>
      ) : (
        <ChatPanel initialMessages={initialMessages} />
      )}

      <p className="text-xs text-slate-400">
        SignalWell AI provides wellbeing insights and educational guidance. It does not provide medical
        diagnosis or emergency mental health care.
      </p>
    </div>
  );
}
