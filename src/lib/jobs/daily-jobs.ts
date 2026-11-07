import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { buildWellbeingDataWindow, hasEnoughDataForAnalysis } from "@/lib/ai/data-window";
import { getAiProvider } from "@/lib/ai";
import { evaluateActivityNotifications, evaluateSleepNotifications } from "@/lib/notifications/rules";
import { lastNDates } from "@/lib/utils/dates";

export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export type JobOutcome =
  | { status: "generated" }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

/**
 * Generates and stores today's AI analysis for one user, if they have
 * analytics enabled and enough real data. Used by both the signed-in
 * "generate my analysis now" route and the scheduled job. Always uses the
 * service-role client, since this runs outside any user's session when
 * called from the scheduler — callers that already hold a validated user
 * session should still pass that user's id and timezone explicitly rather
 * than re-deriving them, to keep this function session-agnostic.
 */
export async function runInsightsJobForUser(
  admin: SupabaseClient<any>,
  userId: string,
  timezone: string,
  force = false
): Promise<JobOutcome> {
  const { data: settings } = await admin
    .from("user_settings")
    .select("analytics_enabled")
    .eq("user_id", userId)
    .single();

  if (settings && settings.analytics_enabled === false) {
    return { status: "skipped", reason: "analytics_disabled" };
  }

  const date = todayInTimezone(timezone);

  const { data: existing } = await admin
    .from("ai_analysis")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("period", "daily")
    .maybeSingle();

  if (existing && !force) {
    return { status: "skipped", reason: "already_generated_today" };
  }

  const window = await buildWellbeingDataWindow(admin, userId, timezone, date);
  if (!hasEnoughDataForAnalysis(window)) {
    return { status: "skipped", reason: "not_enough_data" };
  }

  let result;
  try {
    result = await getAiProvider().generateAnalysis(window);
  } catch (err) {
    console.error(`Insights generation failed for user ${userId}:`, err);
    return { status: "error", reason: "provider_error" };
  }

  const { error } = await admin.from("ai_analysis").upsert(
    {
      user_id: userId,
      date,
      period: "daily",
      model_name: getAiProvider().modelName,
      ...result
    },
    { onConflict: "user_id,date,period" }
  );

  if (error) {
    console.error(`Saving analysis failed for user ${userId}:`, error);
    return { status: "error", reason: "save_failed" };
  }

  return { status: "generated" };
}

/**
 * Evaluates and inserts today's rule-based notifications for one user.
 * Same shared-path reasoning as runInsightsJobForUser above.
 */
export async function runNotificationsJobForUser(
  admin: SupabaseClient<any>,
  userId: string,
  timezone: string
): Promise<JobOutcome> {
  const { data: settings } = await admin
    .from("user_settings")
    .select("notifications_enabled")
    .eq("user_id", userId)
    .single();

  if (settings && settings.notifications_enabled === false) {
    return { status: "skipped", reason: "notifications_disabled" };
  }

  const today = todayInTimezone(timezone);
  const window = lastNDates(8, timezone);

  const [{ data: activityRows }, { data: sleepRows }, { data: existingToday }] = await Promise.all([
    admin.from("daily_activity").select("*").eq("user_id", userId).gte("date", window[0]),
    admin.from("sleep_records").select("*").eq("user_id", userId).gte("date", window[0]),
    admin.from("notifications").select("type").eq("user_id", userId).gte("created_at", `${today}T00:00:00Z`)
  ]);

  const todayActivity = (activityRows ?? []).find((r) => r.date === today) ?? null;
  const priorActivity = (activityRows ?? []).filter((r) => r.date !== today);
  const todaySleep = (sleepRows ?? []).find((r) => r.date === today) ?? null;
  const priorSleep = (sleepRows ?? []).filter((r) => r.date !== today);

  const alreadyNotifiedTypes = new Set((existingToday ?? []).map((n) => n.type));

  const candidates = [
    ...evaluateActivityNotifications(todayActivity, priorActivity),
    ...evaluateSleepNotifications(todaySleep, priorSleep)
  ].filter((c) => !alreadyNotifiedTypes.has(c.type));

  if (candidates.length === 0) {
    return { status: "skipped", reason: "nothing_to_notify" };
  }

  const { error } = await admin
    .from("notifications")
    .insert(candidates.map((c) => ({ user_id: userId, ...c, read: false })));

  if (error) {
    console.error(`Saving notifications failed for user ${userId}:`, error);
    return { status: "error", reason: "save_failed" };
  }

  return { status: "generated" };
}
