import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { lastNDates } from "@/lib/utils/dates";

const mobileUsageSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mobile_social_media_minutes: z.number().int().min(0).max(1440)
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
  const parsed = mobileUsageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid date and a whole number from 0 to 1440 minutes." }, { status: 400 });
  }

  const [{ data: settings }, { data: profile }] = await Promise.all([
    supabase.from("user_settings").select("data_collection_enabled").eq("user_id", user.id).single(),
    supabase.from("profiles").select("timezone").eq("user_id", user.id).single()
  ]);

  if (settings && settings.data_collection_enabled === false) {
    return NextResponse.json({ error: "Data collection is turned off in your privacy settings." }, { status: 403 });
  }

  const timezone = profile?.timezone ?? "UTC";
  const today = todayInTimezone(timezone);
  const earliestDate = lastNDates(30, timezone)[0];
  const parsedDate = new Date(`${parsed.data.date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== parsed.data.date ||
    parsed.data.date < earliestDate ||
    parsed.data.date > today
  ) {
    return NextResponse.json({ error: "Choose a date within the last 30 days, up to today." }, { status: 400 });
  }

  const { error } = await supabase.from("daily_activity").upsert(
    {
      user_id: user.id,
      date: parsed.data.date,
      mobile_social_media_minutes: parsed.data.mobile_social_media_minutes
    },
    { onConflict: "user_id,date" }
  );

  if (error) {
    return NextResponse.json({ error: "We couldn't save your mobile usage. Apply the latest database migration and try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
