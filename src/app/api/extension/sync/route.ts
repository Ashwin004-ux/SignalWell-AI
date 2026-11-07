import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, UsageCategory } from "@/lib/types/database";

const CATEGORIES = [
  "social_media",
  "entertainment",
  "productivity",
  "communication",
  "education",
  "gaming",
  "other"
] as const satisfies readonly UsageCategory[];

const syncSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sites: z
    .array(
      z.object({
        domain: z.string().min(1).max(255),
        category: z.enum(CATEGORIES),
        usage_minutes: z.number().int().min(0),
        launch_count: z.number().int().min(0).default(0)
      })
    )
    .max(500),
  late_night_usage_minutes: z.number().int().min(0).default(0),
  notifications_count: z.number().int().min(0).default(0),
  app_switches: z.number().int().min(0).default(0),
  tracking_coverage_minutes: z.number().int().min(0).max(1440).default(0)
});

/**
 * The extension never holds the service-role key. It authenticates as the
 * signed-in user (an access token obtained through Supabase Auth in the
 * options page login flow) and that token is forwarded here as a Bearer
 * token. This client is built with the ANON key plus that Authorization
 * header, so every insert below still runs under the user's own Row Level
 * Security policies — a compromised extension token can only ever write
 * that one user's rows, exactly like the web app.
 */
function createTokenScopedClient(accessToken: string) {
  return createSupabaseClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid authorization." }, { status: 401 });
  }
  const accessToken = authHeader.slice("Bearer ".length);
  const supabase = createTokenScopedClient(accessToken);

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Your session has expired. Log in again in the extension." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "That sync payload was malformed." }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("data_collection_enabled")
    .eq("user_id", user.id)
    .single();

  if (settings && settings.data_collection_enabled === false) {
    return NextResponse.json(
      { error: "Data collection is turned off in this account's privacy settings." },
      { status: 403 }
    );
  }

  const { date, sites, late_night_usage_minutes, notifications_count, app_switches, tracking_coverage_minutes } = parsed.data;

  // Replace today's per-site rows for this user with the latest sync, then
  // roll them up into the daily_activity summary row.
  await supabase.from("application_usage").delete().eq("user_id", user.id).eq("date", date);

  if (sites.length > 0) {
    const { error: usageError } = await supabase.from("application_usage").insert(
      sites.map((s) => ({
        user_id: user.id,
        date,
        application_name: s.domain,
        category: s.category,
        usage_minutes: s.usage_minutes,
        launch_count: s.launch_count
      }))
    );
    if (usageError) {
      return NextResponse.json({ error: "We couldn't save your site usage." }, { status: 500 });
    }
  }

  const totals = sites.reduce(
    (acc, s) => {
      acc.total += s.usage_minutes;
      acc[s.category] += s.usage_minutes;
      return acc;
    },
    {
      total: 0,
      social_media: 0,
      entertainment: 0,
      productivity: 0,
      communication: 0,
      education: 0,
      gaming: 0,
      other: 0
    }
  );

  const { error: activityError } = await supabase.from("daily_activity").upsert(
    {
      user_id: user.id,
      date,
      total_screen_time_minutes: totals.total,
      active_device_minutes: totals.total,
      social_media_minutes: totals.social_media,
      entertainment_minutes: totals.entertainment,
      productivity_minutes: totals.productivity,
      communication_minutes: totals.communication,
      education_minutes: totals.education,
      gaming_minutes: totals.gaming,
      late_night_usage_minutes,
      notifications_count,
      app_switches,
      tracking_coverage_minutes
    },
    { onConflict: "user_id,date" }
  );

  if (activityError) {
    console.error("[extension/sync] daily_activity upsert failed", {
      code: activityError.code,
      message: activityError.message,
      details: activityError.details,
      hint: activityError.hint
    });
    return NextResponse.json(
      {
        error: "We couldn't save today's activity summary.",
        ...(process.env.NODE_ENV !== "production" && {
          details: activityError.message,
          code: activityError.code
        })
      },
      { status: 500 }
    );
  }

  await supabase
    .from("extension_devices")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
