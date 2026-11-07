import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z
  .object({
    notifications_enabled: z.boolean(),
    data_collection_enabled: z.boolean(),
    chatbot_enabled: z.boolean(),
    analytics_enabled: z.boolean(),
    chatbot_can_access_activity_data: z.boolean()
  })
  .partial();

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You need to be signed in to do that." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Those settings couldn't be saved." }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_settings")
    .update(parsed.data)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "We couldn't update your settings. Try again in a moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
