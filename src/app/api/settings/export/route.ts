import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns every row this user owns across the app's tables as a single JSON
 * document. Row Level Security means each query below can only ever return
 * this user's own data, regardless of table size.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You need to be signed in to do that." }, { status: 401 });
  }

  const tables = [
    "profiles",
    "daily_activity",
    "application_usage",
    "sleep_records",
    "mood_records",
    "ai_analysis",
    "chatbot_conversations",
    "chatbot_messages",
    "notifications",
    "user_settings",
    "extension_devices"
  ] as const;

  const results = await Promise.all(
    tables.map((table) => supabase.from(table).select("*").eq("user_id", user.id))
  );

  const errorResult = results.find((r) => r.error);
  if (errorResult?.error) {
    return NextResponse.json(
      { error: "We couldn't put together your export. Try again in a moment." },
      { status: 500 }
    );
  }

  const exportPayload = Object.fromEntries(tables.map((table, i) => [table, results[i]!.data]));

  return NextResponse.json(
    { exported_at: new Date().toISOString(), user_id: user.id, data: exportPayload },
    {
      headers: {
        "Content-Disposition": `attachment; filename="signalwell-export-${user.id}.json"`
      }
    }
  );
}
