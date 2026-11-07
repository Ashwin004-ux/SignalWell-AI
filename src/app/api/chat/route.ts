import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai";
import { buildWellbeingDataWindow, hasEnoughDataForAnalysis } from "@/lib/ai/data-window";
import { checkRateLimit } from "@/lib/rate-limit";

const chatSchema = z.object({
  conversation_id: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(4000)
});

function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You need to be signed in to do that." }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`chat:${user.id}`, 20, 5 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "You're sending messages faster than the assistant can keep up. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "That message couldn't be sent." }, { status: 400 });
  }

  const [{ data: settings }, { data: profile }] = await Promise.all([
    supabase
      .from("user_settings")
      .select("chatbot_enabled, chatbot_can_access_activity_data")
      .eq("user_id", user.id)
      .single(),
    supabase.from("profiles").select("timezone").eq("user_id", user.id).single()
  ]);

  if (settings && (settings as any).chatbot_enabled === false) {
    return NextResponse.json({ error: "The assistant is turned off in your privacy settings." }, { status: 403 });
  }

  let conversationId = parsed.data.conversation_id ?? null;
  if (!conversationId) {
    const { data: conversation, error: convError } = await supabase
      .from("chatbot_conversations")
      .insert({ user_id: user.id, title: parsed.data.message.slice(0, 60) } as any)
      .select("id")
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "We couldn't start a new conversation." }, { status: 500 });
    }
    conversationId = (conversation as any).id;
  }

  const { data: history } = await supabase
    .from("chatbot_messages")
    .select("role, message")
    .eq("conversation_id", conversationId!)
    .order("created_at", { ascending: true })
    .limit(20);

  await supabase.from("chatbot_messages").insert({
    conversation_id: conversationId!,
    user_id: user.id,
    role: "user",
    message: parsed.data.message
  } as any);

  let wellbeingData = null;
  if ((settings as any)?.chatbot_can_access_activity_data !== false) {
    const timezone = (profile as any)?.timezone ?? "UTC";
    const window = await buildWellbeingDataWindow(supabase as any, user.id, timezone, todayInTimezone(timezone));
    if (hasEnoughDataForAnalysis(window)) {
      wellbeingData = window;
    }
  }

  let result;
  try {
    result = await getAiProvider().generateChatResponse({
      conversationHistory: ((history as any) ?? []).map((m: any) => ({
        role: m.role as "user" | "assistant",
        message: m.message
      })),
      userMessage: parsed.data.message,
      wellbeingData
    });
  } catch (err) {
    console.error("Chat generation failed:", err);
    return NextResponse.json(
      { error: "We couldn't get a response right now. Try again in a moment." },
      { status: 502 }
    );
  }

  await supabase.from("chatbot_messages").insert({
    conversation_id: conversationId!,
    user_id: user.id,
    role: "assistant",
    message: result.message
  } as any);

  await (supabase.from("chatbot_conversations") as any).update({ updated_at: new Date().toISOString() }).eq("id", conversationId!);

  return NextResponse.json({
    conversation_id: conversationId,
    message: result.message,
    safety_triggered: result.safetyTriggered
  });
}
