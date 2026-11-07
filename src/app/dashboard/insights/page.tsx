import { Lightbulb } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeading } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { GenerateAnalysisButton } from "@/components/dashboard/generate-analysis-button";

export default async function InsightsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: analyses } = await supabase
    .from("ai_analysis")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(14);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Insights</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every item below is AI-generated interpretation of your data, not a verified fact or diagnosis.
          </p>
        </div>
        <GenerateAnalysisButton />
      </div>

      {(!analyses || analyses.length === 0) && (
        <EmptyState
          icon={Lightbulb}
          title="No insights yet"
          description="Record browser activity, phone social-media minutes, sleep, or mood on at least 3 of the last 7 days, then generate your analysis."
        />
      )}

      <div className="flex flex-col gap-4">
        {(analyses ?? []).map((a) => (
          <Card key={a.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-signal-500/10 px-1.5 py-0.5 text-xs font-medium text-signal-700">
                  AI Insight
                </span>
                <CardHeading className="mb-0">{a.date}</CardHeading>
              </div>
              <StatusBadge level={a.risk_level} />
            </div>

            <p className="mt-3 text-sm text-slate-700">{a.summary}</p>

            {a.contributing_factors?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500">Contributing factors</p>
                <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                  {a.contributing_factors.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {a.recommendations?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500">Recommendations</p>
                <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                  {a.recommendations.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-3 text-xs text-slate-400">
              Confidence {a.confidence != null ? `${Math.round(a.confidence * 100)}%` : "—"} ·{" "}
              {a.model_name ?? "model not recorded"}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
