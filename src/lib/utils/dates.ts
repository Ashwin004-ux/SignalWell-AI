/** Returns the last `days` ISO date strings (YYYY-MM-DD), oldest first, ending today. */
export function lastNDates(days: number, timezone = "UTC"): string[] {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const [year, month, day] = today.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(cursor);
    date.setUTCDate(date.getUTCDate() - i);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

/** Short weekday/day label for chart axes, e.g. "Mon 14". */
export function shortDateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

export function minutesToHoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
