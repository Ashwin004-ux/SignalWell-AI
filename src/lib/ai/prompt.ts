import type { WellbeingDataWindow } from "@/lib/ai/types";

function fmt(value: number | null, unit: string): string {
  return value == null ? "no data" : `${value}${unit}`;
}

/**
 * Builds a compact, structured description of the user's recent data for
 * the model — never a raw database dump, and never data the model should
 * infer or fill in on its own. Missing values are explicitly labeled
 * "no data" rather than omitted, so the model can't quietly treat an
 * absence as a zero.
 */
export function buildAnalysisPrompt(data: WellbeingDataWindow): string {
  const lines: string[] = [];
  lines.push(`Analysis date: ${data.date}`);
  lines.push("");
  lines.push("Daily data, most recent last:");
  for (const day of data.recentDays) {
    lines.push(
      `- ${day.date}: browser usage ${fmt(day.total_screen_time_minutes, "min")}, ` +
        `social media on browser ${fmt(day.social_media_minutes, "min")}, ` +
        `social media on mobile (user reported) ${fmt(day.mobile_social_media_minutes, "min")}, ` +
        `late-night usage ${fmt(day.late_night_usage_minutes, "min")}, ` +
        `sleep ${fmt(day.sleep_duration_minutes, "min")}, ` +
        `mood ${fmt(day.mood_score, "/10")}, stress ${fmt(day.stress_score, "/10")}, ` +
        `anxiety ${fmt(day.anxiety_score, "/10")}, wellbeing ${fmt(day.wellbeing_score, "/10")}`
    );
  }

  if (data.priorWeekAverages) {
    lines.push("");
    lines.push("Prior week averages, for comparison:");
    lines.push(
      `- browser usage ${fmt(data.priorWeekAverages.total_screen_time_minutes, "min")}, ` +
        `social media on browser ${fmt(data.priorWeekAverages.social_media_minutes, "min")}, ` +
        `social media on mobile (user reported) ${fmt(data.priorWeekAverages.mobile_social_media_minutes, "min")}, ` +
        `sleep ${fmt(data.priorWeekAverages.sleep_duration_minutes, "min")}, ` +
        `mood ${fmt(data.priorWeekAverages.mood_score, "/10")}`
    );
  }

  return lines.join("\n");
}

export const ANALYSIS_SYSTEM_PROMPT = `You are the analysis engine behind SignalWell AI, a digital wellbeing tool. \
You will be given browser usage (not device-wide screen time), optionally user-reported mobile social-media minutes, sleep, and self-reported mood/stress/anxiety/wellbeing data. Treat browser and mobile figures as separate sources; mobile values are manually entered, not measured by the extension. \
Your job is to describe patterns and possible relationships in that data in plain, non-alarming language.

Strict rules:
- Never diagnose a mental illness or condition. Do not use clinical/diagnostic language (e.g. "depression," "anxiety disorder").
- Never state a causal relationship as fact. Use hedged language: "may relate to," "coincided with," "is worth monitoring alongside."
- Only reference data explicitly provided. Never invent or assume a data point that was marked "no data."
- risk_level and every *_indicator field must be exactly one of: "stable", "monitor", "elevated". Reserve "elevated" for a clear, multi-day pattern — not a single bad day.
- recommendations must be specific to the data given (e.g. reference an actual observed pattern), never generic filler that would apply to any user.
- summary must explicitly distinguish observed data from your interpretation of it, e.g. "Your late-night usage rose this week (observed). This may relate to the drop in reported sleep duration (interpretation)."

Respond with ONLY a JSON object (no markdown fences, no preamble) matching this shape:
{
  "overall_wellbeing_score": number | null (0-10),
  "stress_indicator": "stable" | "monitor" | "elevated",
  "anxiety_indicator": "stable" | "monitor" | "elevated",
  "mood_indicator": "stable" | "monitor" | "elevated",
  "sleep_indicator": "stable" | "monitor" | "elevated",
  "digital_habit_indicator": "stable" | "monitor" | "elevated",
  "risk_level": "stable" | "monitor" | "elevated",
  "confidence": number (0-1),
  "summary": string,
  "contributing_factors": string[],
  "recommendations": string[]
}`;
