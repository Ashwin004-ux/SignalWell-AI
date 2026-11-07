import { Puzzle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeading } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { CategoryBarChart } from "@/components/dashboard/category-bar-chart";
import { MobileUsageForm } from "@/components/dashboard/mobile-usage-form";
import { lastNDates, shortDateLabel, minutesToHoursLabel, average } from "@/lib/utils/dates";
import type { DailyActivity, ApplicationUsage } from "@/lib/types/database";

const CATEGORY_LABELS: Record<string, string> = {
  social_media: "Social media",
  entertainment: "Entertainment",
  productivity: "Productivity",
  communication: "Communication",
  education: "Education",
  gaming: "Gaming",
  other: "Other"
};

export default async function ActivityPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .single();
  const timezone = profile?.timezone ?? "UTC";

  const last30 = lastNDates(30, timezone);
  const last7 = lastNDates(7, timezone);
  const today = last30[last30.length - 1];

  const [{ data: activityRows }, { data: usageRows }] = await Promise.all([
    supabase
      .from("daily_activity")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", last30[0])
      .order("date", { ascending: true }),
    supabase
      .from("application_usage")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", last7[0])
  ]);

  const activityByDate = new Map<string, DailyActivity>();
  (activityRows ?? []).forEach((r) => activityByDate.set(r.date, r));

  const hasAnyActivity = (activityRows ?? []).some(
    (row) => hasBrowserTracking(row) || row.mobile_social_media_minutes != null
  );

  const screenTimeSeries = last30.map((date) => ({
    label: shortDateLabel(date),
    value: hasBrowserTracking(activityByDate.get(date))
      ? activityByDate.get(date)!.total_screen_time_minutes
      : null
  }));

  const socialSeries = last30.map((date) => ({
    label: shortDateLabel(date),
    value: hasBrowserTracking(activityByDate.get(date))
      ? activityByDate.get(date)!.social_media_minutes
      : null
  }));

  const mobileSocialSeries = last30.map((date) => ({
    label: shortDateLabel(date),
    value: activityByDate.get(date)?.mobile_social_media_minutes ?? null
  }));

  const last7Rows = last7.map((date) => activityByDate.get(date)).filter(hasBrowserTracking);
  const last30BrowserRows = last30.map((date) => activityByDate.get(date)).filter(hasBrowserTracking);
  const last7MobileRows = last7
    .map((date) => activityByDate.get(date))
    .filter((row): row is DailyActivity => row?.mobile_social_media_minutes != null);
  const avgScreenTime = average(last7Rows.map((r) => r.total_screen_time_minutes));
  const avgSocial = average(last7Rows.map((r) => r.social_media_minutes));
  const avgLateNight = average(last7Rows.map((r) => r.late_night_usage_minutes));
  const avgMobileSocial = average(last7MobileRows.map((r) => r.mobile_social_media_minutes!));

  const categoryTotals = new Map<string, number>();
  (usageRows ?? []).forEach((r: ApplicationUsage) => {
    categoryTotals.set(r.category, (categoryTotals.get(r.category) ?? 0) + r.usage_minutes);
  });
  const categoryData = Array.from(categoryTotals.entries())
    .map(([category, minutes]) => ({ label: CATEGORY_LABELS[category] ?? category, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Activity</h1>
        <p className="mt-1 text-sm text-slate-500">
          Browser usage comes from the extension. Phone social-media minutes can be entered manually from Screen Time or Digital Wellbeing.
        </p>
      </div>

      {!hasAnyActivity && (
        <EmptyState
          icon={Puzzle}
          title="No activity data yet"
          description="Connect the browser extension or add mobile social-media minutes below."
          actionLabel="Connect Extension"
          actionHref="/dashboard/privacy"
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeading>7-day avg. browser usage</CardHeading>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {last7Rows.length > 0 ? minutesToHoursLabel(avgScreenTime) : "No browser data logged"}
          </p>
        </Card>
        <Card>
          <CardHeading>7-day avg. browser social media</CardHeading>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {last7Rows.length > 0 ? minutesToHoursLabel(avgSocial) : "No browser data logged"}
          </p>
        </Card>
        <Card>
          <CardHeading>7-day avg. mobile social media</CardHeading>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {last7MobileRows.length > 0 ? minutesToHoursLabel(avgMobileSocial) : "Not logged yet"}
          </p>
        </Card>
        <Card>
          <CardHeading>7-day avg. late-night browser usage</CardHeading>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {last7Rows.length > 0 ? minutesToHoursLabel(avgLateNight) : "Not enough data yet"}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeading>Log mobile social-media usage</CardHeading>
        <p className="mt-1 text-sm text-slate-500">
          Use the daily social-media total shown by your phone. After logging data on at least 3 of the last 7 days, open Insights and generate or refresh the analysis.
        </p>
        <MobileUsageForm
          initialDate={today}
          minDate={last30[0]}
          entries={(activityRows ?? [])
            .filter((row) => row.mobile_social_media_minutes != null)
            .map((row) => ({ date: row.date, minutes: row.mobile_social_media_minutes! }))}
        />
      </Card>

      <Card>
        <CardHeading>Browser usage — last 30 days</CardHeading>
        {last30BrowserRows.length >= 2 ? (
          <div className="mt-3">
            <TrendChart
              data={screenTimeSeries}
              valueLabel="Browser usage"
              valueFormatter="minutesToHours"
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Not enough data yet — need at least two days logged.</p>
        )}
      </Card>

      <Card>
        <CardHeading>Browser social media — last 30 days</CardHeading>
        {last30BrowserRows.length >= 2 ? (
          <div className="mt-3">
            <TrendChart
              data={socialSeries}
              valueLabel="Social media"
              color="#B8862E"
              valueFormatter="minutesToHours"
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Not enough data yet — need at least two days logged.</p>
        )}
      </Card>

      <Card>
        <CardHeading>Mobile social-media usage — last 30 days</CardHeading>
        {last30.some((date) => activityByDate.get(date)?.mobile_social_media_minutes != null) ? (
          <div className="mt-3">
            <TrendChart
              data={mobileSocialSeries}
              valueLabel="Mobile social media"
              color="#718B7C"
              valueFormatter="minutesToHours"
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">No manual mobile entries yet.</p>
        )}
      </Card>

      <Card>
        <CardHeading>Browser category breakdown — last 7 days</CardHeading>
        {categoryData.length > 0 ? (
          <div className="mt-3">
            <CategoryBarChart data={categoryData} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Not enough data yet</p>
        )}
      </Card>
    </div>
  );
}

function hasBrowserTracking(row: DailyActivity | undefined): row is DailyActivity {
  return Boolean(
    row &&
      (row.tracking_coverage_minutes > 0 ||
        row.total_screen_time_minutes > 0 ||
        row.social_media_minutes > 0 ||
        row.late_night_usage_minutes > 0)
  );
}
