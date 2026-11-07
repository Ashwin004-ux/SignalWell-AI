import { createClient } from "@/lib/supabase/server";
import { SleepForm } from "@/components/dashboard/sleep-form";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Card, CardHeading } from "@/components/ui/card";
import { lastNDates, shortDateLabel } from "@/lib/utils/dates";
import type { SleepRecord } from "@/lib/types/database";

export default async function SleepPage() {
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

  const last30 = lastNDates(30, profile?.timezone ?? "UTC");

  const { data: recent } = await supabase
    .from("sleep_records")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", last30[0])
    .order("date", { ascending: true });

  const byDate = new Map<string, SleepRecord>();
  (recent ?? []).forEach((r) => byDate.set(r.date, r));

  const durationSeries = last30.map((date) => ({
    label: shortDateLabel(date),
    value: byDate.get(date)?.sleep_duration_minutes ?? null
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Sleep</h1>
        <p className="mt-1 text-sm text-slate-500">
          Log last night's sleep. SignalWell looks at duration and consistency alongside your other data —
          it does not diagnose sleep disorders.
        </p>
      </div>

      <Card>
        <CardHeading>Log last night</CardHeading>
        <SleepForm initialDate={last30[last30.length - 2] ?? last30[last30.length - 1]} />
      </Card>

      <Card>
        <CardHeading>Duration trend — last 30 days</CardHeading>
        {recent && recent.length >= 2 ? (
          <div className="mt-3">
            <TrendChart
              data={durationSeries}
              valueLabel="Sleep duration"
              color="#5A636B"
              valueFormatter="minutesToHours"
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            Log a few more nights to start seeing a trend.
          </p>
        )}
      </Card>

      <Card>
        <CardHeading>Recent entries</CardHeading>
        {recent && recent.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {[...recent].reverse().map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-500">{r.date}</span>
                <span className="text-ink">
                  {r.sleep_duration_minutes != null
                    ? `${Math.floor(r.sleep_duration_minutes / 60)}h ${r.sleep_duration_minutes % 60}m`
                    : "—"}
                  {r.sleep_quality ? ` · Quality ${r.sleep_quality}/5` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Not enough data yet</p>
        )}
      </Card>
    </div>
  );
}
