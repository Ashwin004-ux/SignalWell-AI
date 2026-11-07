import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { runInsightsJobForUser } from "@/lib/jobs/daily-jobs";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * User-triggered analysis generation or refresh, for the Insights action
 * button on /dashboard/insights. Shares its actual logic with the scheduled
 * job (src/lib/jobs/daily-jobs.ts) so the two paths can't drift apart —
 * this route just authenticates the caller as themselves, then runs that
 * same per-user job via the service-role client (ai_analysis has no
 * user-facing insert policy; see supabase/policies.sql).
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You need to be signed in to do that." }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`insights:${user.id}`, 5, 10 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "You've requested a few analyses already. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("user_id", user.id).single();
  const admin = createServiceRoleClient();

  const outcome = await runInsightsJobForUser(admin, user.id, profile?.timezone ?? "UTC", true);

  if (outcome.status === "error") {
    return NextResponse.json({ error: "We couldn't generate or save your analysis. Try again in a moment." }, { status: 502 });
  }
  if (outcome.status === "skipped" && outcome.reason === "not_enough_data") {
    return NextResponse.json(
      { error: "Not enough data yet. Record browser activity, phone social-media minutes, sleep, or mood on at least 3 of the last 7 days first." },
      { status: 422 }
    );
  }
  if (outcome.status === "skipped" && outcome.reason === "analytics_disabled") {
    return NextResponse.json(
      { error: "AI wellbeing analysis is turned off in your privacy settings." },
      { status: 403 }
    );
  }
  if (outcome.status === "skipped" && outcome.reason === "already_generated_today") {
    return NextResponse.json({ ok: true, alreadyGenerated: true });
  }

  return NextResponse.json({ ok: true });
}
