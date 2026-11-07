import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const moodSchema = z.object({
  mood_score: z.number().int().min(1).max(10),
  stress_score: z.number().int().min(1).max(10),
  anxiety_score: z.number().int().min(1).max(10),
  wellbeing_score: z.number().int().min(1).max(10),
  energy_score: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
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

  const body = await request.json().catch(() => null);
  const parsed = moodSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "That entry couldn't be saved. Check the values and try again." },
      { status: 400 }
    );
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("data_collection_enabled")
    .eq("user_id", user.id)
    .single();

  if (settings && settings.data_collection_enabled === false) {
    return NextResponse.json(
      { error: "Data collection is turned off in your privacy settings." },
      { status: 403 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .single();

  const date = todayInTimezone(profile?.timezone ?? "UTC");

  const { error } = await supabase
    .from("mood_records")
    .upsert(
      { user_id: user.id, date, ...parsed.data },
      { onConflict: "user_id,date" }
    );

  if (error) {
    return NextResponse.json(
      { error: "We couldn't save your mood entry. Try again in a moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
