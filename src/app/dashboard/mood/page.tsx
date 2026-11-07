import { createClient } from "@/lib/supabase/server";
import { MoodForm } from "@/components/dashboard/mood-form";
import { MultiTrendChart } from "@/components/dashboard/multi-trend-chart";
import { Card, CardHeading } from "@/components/ui/card";
import { lastNDates, shortDateLabel } from "@/lib/utils/dates";
import type { MoodRecord } from "@/lib/types/database";

export default async function MoodPage() {
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
    .from("mood_records")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", last30[0])
    .order("date", { ascending: true });

  const byDate = new Map<string, MoodRecord>();
  (recent ?? []).forEach((r) => byDate.set(r.date, r));

  const chartData = last30.map((date) => {
    const r = byDate.get(date);
    return {
      label: shortDateLabel(date),
      mood: r?.mood_score ?? null,
      stress: r?.stress_score ?? null,
      anxiety: r?.anxiety_score ?? null,
      wellbeing: r?.wellbeing_score ?? null
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Mood</h1>
        <p className="mt-1 text-sm text-slate-500">
          A short daily self-report. This is the data SignalWell's analysis relates to your activity and sleep.
        </p>
      </div>

      <Card>
        <CardHeading>Log today</CardHeading>
        <MoodForm />
      </Card>

      <Card>
        <CardHeading>Trend — last 30 days</CardHeading>
        {recent && recent.length >= 2 ? (
          <div className="mt-3">
            <MultiTrendChart
              data={chartData}
              series={[
                { key: "mood", label: "Mood", color: "#2F6E5E" },
                { key: "stress", label: "Stress", color: "#B8862E" },
                { key: "anxiety", label: "Anxiety", color: "#B0472F" },
                { key: "wellbeing", label: "Wellbeing", color: "#5A636B" }
              ]}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            Record your mood for a few more days to start seeing a trend.
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
                  Mood {r.mood_score}/10 · Stress {r.stress_score}/10 · Anxiety {r.anxiety_score}/10
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
