import type { DailyActivity, SleepRecord } from "@/lib/types/database";

export interface NotificationCandidate {
  type: "high_screen_time" | "late_night_usage" | "sleep_pattern" | "positive_change";
  title: string;
  message: string;
  severity: "info" | "notice" | "elevated";
}

const HIGH_SCREEN_TIME_THRESHOLD = 1.3; // 30% above the 7-day average
const POSITIVE_CHANGE_THRESHOLD = 0.85; // 15% below the 7-day average
const SLEEP_DROP_THRESHOLD_MINUTES = 45;

/**
 * Pure functions, deliberately not AI-generated — these are simple threshold
 * comparisons against the user's own recent average, not a clinical
 * judgment. Every message states the actual numbers rather than a vague
 * alarm, per the "no alarming language" requirement in the spec.
 */
export function evaluateActivityNotifications(
  today: DailyActivity | null,
  priorDays: DailyActivity[]
): NotificationCandidate[] {
  if (!today || priorDays.length < 3) return [];

  const candidates: NotificationCandidate[] = [];
  const avgScreenTime = average(priorDays.map((d) => d.total_screen_time_minutes));
  const avgLateNight = average(priorDays.map((d) => d.late_night_usage_minutes));

  if (avgScreenTime > 0 && today.total_screen_time_minutes > avgScreenTime * HIGH_SCREEN_TIME_THRESHOLD) {
    candidates.push({
      type: "high_screen_time",
      title: "Higher browser usage today",
      message: `Your browser usage today (${formatMinutes(today.total_screen_time_minutes)}) is higher than your recent average (${formatMinutes(Math.round(avgScreenTime))}). Consider taking a short break.`,
      severity: "notice"
    });
  }

  if (avgScreenTime > 0 && today.total_screen_time_minutes < avgScreenTime * POSITIVE_CHANGE_THRESHOLD) {
    candidates.push({
      type: "positive_change",
      title: "Browser usage is down",
      message: `Your browser usage today (${formatMinutes(today.total_screen_time_minutes)}) is lower than your recent average (${formatMinutes(Math.round(avgScreenTime))}).`,
      severity: "info"
    });
  }

  if (today.late_night_usage_minutes > 0 && today.late_night_usage_minutes > Math.max(avgLateNight * 1.3, 30)) {
    candidates.push({
      type: "late_night_usage",
      title: "Late-night device usage",
      message: `You were active on your device later than usual tonight (${formatMinutes(today.late_night_usage_minutes)} between 11pm–5am).`,
      severity: "notice"
    });
  }

  return candidates;
}

export function evaluateSleepNotifications(
  today: SleepRecord | null,
  priorDays: SleepRecord[]
): NotificationCandidate[] {
  if (!today?.sleep_duration_minutes || priorDays.length < 3) return [];

  const priorDurations = priorDays.map((d) => d.sleep_duration_minutes).filter((d): d is number => d != null);
  if (priorDurations.length < 3) return [];

  const avgDuration = average(priorDurations);
  if (avgDuration - today.sleep_duration_minutes > SLEEP_DROP_THRESHOLD_MINUTES) {
    return [
      {
        type: "sleep_pattern",
        title: "Shorter sleep than usual",
        message: `Last night's sleep (${formatMinutes(today.sleep_duration_minutes)}) was shorter than your recent average (${formatMinutes(Math.round(avgDuration))}).`,
        severity: "notice"
      }
    ];
  }

  return [];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
