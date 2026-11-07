import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runNotificationsJobForUser } from "@/lib/jobs/daily-jobs";

/**
 * Scheduled entry point for rule-based notifications. Same auth pattern and
 * per-user isolation as /api/cron/generate-insights — see that file's
 * comment for how to wire the schedule itself. Supports GET (Vercel Cron)
 * and POST (manual / Supabase pg_net).
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  const { data: profiles, error } = await admin.from("profiles").select("user_id, timezone");
  if (error || !profiles) {
    return NextResponse.json({ error: "Couldn't load the user list." }, { status: 500 });
  }

  const results: Record<string, string> = {};
  let generated = 0;
  let errors = 0;

  for (const profile of profiles) {
    const outcome = await runNotificationsJobForUser(admin, profile.user_id, profile.timezone ?? "UTC");
    results[profile.user_id] = outcome.status === "skipped" ? `skipped:${outcome.reason}` : outcome.status;
    if (outcome.status === "generated") generated += 1;
    if (outcome.status === "error") errors += 1;
  }

  return NextResponse.json({
    ok: true,
    usersProcessed: profiles.length,
    generated,
    errors,
    results
  });
}
