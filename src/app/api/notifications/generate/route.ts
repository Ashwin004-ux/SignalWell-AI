import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { runNotificationsJobForUser } from "@/lib/jobs/daily-jobs";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * User-triggered "Check for updates" on /dashboard/notifications. Shares
 * its logic with the scheduled job — see src/lib/jobs/daily-jobs.ts.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You need to be signed in to do that." }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`notifications:${user.id}`, 10, 5 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many checks in a row. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("user_id", user.id).single();
  const admin = createServiceRoleClient();

  const outcome = await runNotificationsJobForUser(admin, user.id, profile?.timezone ?? "UTC");

  if (outcome.status === "error") {
    return NextResponse.json({ error: "We couldn't check for updates right now." }, { status: 502 });
  }
  if (outcome.status === "skipped" && outcome.reason === "notifications_disabled") {
    return NextResponse.json({ error: "Notifications are turned off in your privacy settings." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, created: outcome.status === "generated" ? 1 : 0 });
}
