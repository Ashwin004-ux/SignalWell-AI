import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const sleepSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sleep_start: z.string().datetime().nullable().optional(),
  sleep_end: z.string().datetime().nullable().optional(),
  sleep_duration_minutes: z.number().int().min(0).max(1440),
  sleep_quality: z.number().int().min(1).max(5).nullable().optional(),
  interruptions: z.number().int().min(0).optional()
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You need to be signed in to do that." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sleepSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "That sleep entry couldn't be saved. Check the values and try again." },
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

  const { error } = await supabase
    .from("sleep_records")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id,date" });

  if (error) {
    return NextResponse.json(
      { error: "We couldn't save your sleep entry. Try again in a moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
