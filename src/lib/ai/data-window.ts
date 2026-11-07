import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { WellbeingDataWindow } from "@/lib/ai/types";
import { lastNDates, average } from "@/lib/utils/dates";

type ActivityUsage = {
  tracking_coverage_minutes?: number | null;
  total_screen_time_minutes?: number | null;
  social_media_minutes?: number | null;
  late_night_usage_minutes?: number | null;
};

/**
 * Pulls the last 14 days of daily_activity/sleep_records/mood_records for a
 * user and shapes them into the structured window the AI prompt builder
 * expects. Accepts any already-scoped Supabase client (service-role for the
 * scheduled job, or a token-scoped client for an on-demand user action) —
 * this function itself does no authorization, so the caller must ensure the
 * client is only ever queried for the intended user_id.
 */
export async function buildWellbeingDataWindow(
  supabase: SupabaseClient<any>,
  userId: string,
  timezone: string,
  analysisDate: string
): Promise<WellbeingDataWindow> {
  const window14 = lastNDates(14, timezone);
  const priorWeek = lastNDates(14, timezone).slice(0, 7);

  const [{ data: activity }, { data: sleep }, { data: mood }] = await Promise.all([
    supabase.from("daily_activity").select("*").eq("user_id", userId).gte("date", window14[0]),
    supabase.from("sleep_records").select("*").eq("user_id", userId).gte("date", window14[0]),
    supabase.from("mood_records").select("*").eq("user_id", userId).gte("date", window14[0])
  ]);

  const activityByDate = new Map((activity ?? []).map((r) => [r.date, r]));
  const sleepByDate = new Map((sleep ?? []).map((r) => [r.date, r]));
  const moodByDate = new Map((mood ?? []).map((r) => [r.date, r]));

  const last7 = window14.slice(7);
  const recentDays = last7.map((date) => ({
    date,
    total_screen_time_minutes: hasBrowserActivity(activityByDate.get(date))
      ? activityByDate.get(date)!.total_screen_time_minutes
      : null,
    social_media_minutes: hasBrowserActivity(activityByDate.get(date))
      ? activityByDate.get(date)!.social_media_minutes
      : null,
    mobile_social_media_minutes: activityByDate.get(date)?.mobile_social_media_minutes ?? null,
    late_night_usage_minutes: hasBrowserActivity(activityByDate.get(date))
      ? activityByDate.get(date)!.late_night_usage_minutes
      : null,
    sleep_duration_minutes: sleepByDate.get(date)?.sleep_duration_minutes ?? null,
    mood_score: moodByDate.get(date)?.mood_score ?? null,
    stress_score: moodByDate.get(date)?.stress_score ?? null,
    anxiety_score: moodByDate.get(date)?.anxiety_score ?? null,
    wellbeing_score: moodByDate.get(date)?.wellbeing_score ?? null
  }));

  const priorRows = priorWeek.map((date) => ({
    activity: activityByDate.get(date),
    sleep: sleepByDate.get(date),
    mood: moodByDate.get(date)
  }));
  const hasPriorData = priorRows.some(
    (r) => hasBrowserActivity(r.activity) || r.activity?.mobile_social_media_minutes != null || r.sleep || r.mood
  );

  return {
    date: analysisDate,
    recentDays,
    priorWeekAverages: hasPriorData
      ? {
          total_screen_time_minutes: averageOrNull(
            priorRows.map((r) => hasBrowserActivity(r.activity) ? r.activity!.total_screen_time_minutes : null)
          ),
          social_media_minutes: averageOrNull(
            priorRows.map((r) => hasBrowserActivity(r.activity) ? r.activity!.social_media_minutes : null)
          ),
          mobile_social_media_minutes: averageOrNull(
            priorRows.map((r) => r.activity?.mobile_social_media_minutes)
          ),
          sleep_duration_minutes: averageOrNull(priorRows.map((r) => r.sleep?.sleep_duration_minutes)),
          mood_score: averageOrNull(priorRows.map((r) => r.mood?.mood_score))
        }
      : null
  };
}

function hasBrowserActivity(activity: ActivityUsage | null | undefined): boolean {
  return Boolean(
    activity &&
      (activity.tracking_coverage_minutes > 0 ||
        activity.total_screen_time_minutes > 0 ||
        activity.social_media_minutes > 0 ||
        activity.late_night_usage_minutes > 0)
  );
}

function averageOrNull(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  return nums.length > 0 ? Math.round(average(nums) * 10) / 10 : null;
}

/** True once there's enough real data to bother generating an analysis. */
export function hasEnoughDataForAnalysis(window: WellbeingDataWindow): boolean {
  const daysWithAnyData = window.recentDays.filter(
    (d) =>
      d.total_screen_time_minutes != null ||
      d.mobile_social_media_minutes != null ||
      d.sleep_duration_minutes != null ||
      d.mood_score != null
  );
  return daysWithAnyData.length >= 3;
}
