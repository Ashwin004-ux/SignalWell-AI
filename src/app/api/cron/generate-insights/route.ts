import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runInsightsJobForUser } from "@/lib/jobs/daily-jobs";

/**
 * Scheduled entry point: generates today's AI analysis for every user who
 * has enough data and hasn't opted out. Not reachable by a browser session —
 * authorized only by CRON_SECRET, which must be set and kept out of any
 * client-visible code. Wire this to run once per day via either:
 *   - Vercel Cron (see vercel.json in the project root), or
 *   - Supabase pg_cron + pg_net calling this URL with the Authorization
 *     header below (see supabase/cron.sql).
 * Each user is processed independently and a failure for one user doesn't
 * stop the rest — see the per-user `results` array in the response for
 * what happened to each one.
 *
 * Vercel Cron calls this with GET and automatically attaches
 * `Authorization: Bearer $CRON_SECRET` when that env var is set on the
 * project — see vercel.json. POST is also supported for manual triggering
 * or a Supabase pg_net-based schedule (see supabase/cron.sql).
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
    const outcome = await runInsightsJobForUser(admin, profile.user_id, profile.timezone ?? "UTC");
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
