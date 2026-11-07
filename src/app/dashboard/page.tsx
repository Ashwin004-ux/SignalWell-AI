import { Activity, Moon, Smile, Puzzle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeading } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RefreshDashboardButton } from "@/components/dashboard/refresh-dashboard-button";
import { lastNDates } from "@/lib/utils/dates";

export default async function OverviewPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, timezone")
    .eq("user_id", user.id)
    .single();

  const [yesterday, today] = lastNDates(2, profile?.timezone ?? "UTC");

  const [{ data: activity }, { data: mood }, { data: sleep }, { data: analysis }] = await Promise.all([
    supabase.from("daily_activity").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
    supabase.from("mood_records").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
    supabase.from("sleep_records").select("*").eq("user_id", user.id).eq("date", yesterday).maybeSingle(),
    supabase
      .from("ai_analysis")
      .select("*")
      .eq("user_id", user.id)
      .eq("period", "daily")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const hasAnyData = Boolean(
    (activity &&
      (activity.tracking_coverage_minutes > 0 ||
        activity.total_screen_time_minutes > 0 ||
        activity.social_media_minutes > 0 ||
        activity.late_night_usage_minutes > 0 ||
        activity.mobile_social_media_minutes != null)) ||
      mood ||
      sleep
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">
            {profile?.full_name ? `Welcome back, ${profile.full_name.split(" ")[0]}` : "Overview"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Today · {today}</p>
        </div>
        <RefreshDashboardButton />
      </div>

      {!hasAnyData && (
        <EmptyState
          icon={Puzzle}
          title="No activity data yet"
          description="Connect the browser extension, log mobile social-media minutes on Activity, or add a sleep or mood entry."
          actionLabel="Connect Extension"
          actionHref="/dashboard/privacy"
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeading>Browser usage today</CardHeading>
          {activity &&
          (activity.tracking_coverage_minutes > 0 ||
            activity.total_screen_time_minutes > 0 ||
            activity.social_media_minutes > 0 ||
            activity.late_night_usage_minutes > 0) ? (
            <p className="mt-2 text-2xl font-semibold text-ink">
              {Math.floor(activity.total_screen_time_minutes / 60)}h {activity.total_screen_time_minutes % 60}m
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No browser data logged</p>
          )}
        </Card>

        <Card>
          <CardHeading>Mobile social media today</CardHeading>
          {activity?.mobile_social_media_minutes != null ? (
            <p className="mt-2 text-2xl font-semibold text-ink">
              {Math.floor(activity.mobile_social_media_minutes / 60)}h {activity.mobile_social_media_minutes % 60}m
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Not logged yet</p>
          )}
        </Card>

        <Card>
          <CardHeading>Sleep last night</CardHeading>
          {sleep?.sleep_duration_minutes != null ? (
            <p className="mt-2 text-2xl font-semibold text-ink">
              {Math.floor(sleep.sleep_duration_minutes / 60)}h {sleep.sleep_duration_minutes % 60}m
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Not enough data yet</p>
          )}
        </Card>

        <Card>
          <CardHeading>Mood today</CardHeading>
          {mood ? (
            <p className="mt-2 text-2xl font-semibold text-ink">{mood.mood_score}/10</p>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Not recorded yet</p>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <CardHeading>Overall wellbeing status</CardHeading>
          {analysis && <StatusBadge level={analysis.risk_level} />}
        </div>
        {analysis ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-slate-600">{analysis.summary}</p>
            <p className="text-xs text-slate-400">
              Based on data through {analysis.date} · {analysis.model_name ?? "model not recorded"}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-slate-500">
              A status appears after data is recorded on at least 3 of the last 7 days. Browser activity,
              manually logged phone social-media use, sleep, or mood can count. Generate or refresh the analysis from Insights.
            </p>
            <Link
              href="/dashboard/insights"
              className="mt-3 inline-flex items-center rounded-md bg-signal-700 px-3 py-2 text-sm font-medium text-white hover:bg-signal-800"
            >
              Open Insights
            </Link>
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded border border-slate-200 bg-white p-4 text-sm">
          <Activity className="h-5 w-5 text-signal-500" strokeWidth={1.75} aria-hidden="true" />
          <span className="text-slate-600">Log activity data via the browser extension.</span>
        </div>
        <div className="flex items-center gap-3 rounded border border-slate-200 bg-white p-4 text-sm">
          <Moon className="h-5 w-5 text-signal-500" strokeWidth={1.75} aria-hidden="true" />
          <span className="text-slate-600">Record last night's sleep on the Sleep page.</span>
        </div>
        <div className="flex items-center gap-3 rounded border border-slate-200 bg-white p-4 text-sm">
          <Smile className="h-5 w-5 text-signal-500" strokeWidth={1.75} aria-hidden="true" />
          <span className="text-slate-600">Log today's mood on the Mood page.</span>
        </div>
      </div>
    </div>
  );
}
