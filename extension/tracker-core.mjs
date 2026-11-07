export function localDateKey(timestamp) {
  const date = new Date(timestamp);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
export function isLateNight(timestamp, startHour = 23, endHour = 5) {
  const hour = new Date(timestamp).getHours();
  return startHour > endHour ? hour >= startHour || hour < endHour : hour >= startHour && hour < endHour;
}
export function trackingAllowed({ optedIn, focused, idleState, accountId }) {
  return optedIn === true && focused === true && idleState === "active" && typeof accountId === "string" && accountId.length > 0;
}
export function splitInterval(startMs, seconds, startHour = 23, endHour = 5) {
  const byDate = new Map();
  for (let offset = 0; offset < seconds; offset += 1) {
    const timestamp = startMs + offset * 1000;
    const date = localDateKey(timestamp);
    const entry = byDate.get(date) || { date, seconds: 0, lateNightSeconds: 0 };
    entry.seconds += 1;
    if (isLateNight(timestamp, startHour, endHour)) entry.lateNightSeconds += 1;
    byDate.set(date, entry);
  }
  return [...byDate.values()];
}
export function accountDay(activity, date, accountId) {
  const storageKey = accountId + "::" + date;
  const existing = activity[storageKey];
  if (existing) return existing;
  const created = { ownerId: accountId, date, sites: {}, totalSeconds: 0, lateNightSeconds: 0, coverageSeconds: 0, appSwitches: 0 };
  activity[storageKey] = created;
  return created;
}
export function boundedIntervalStart(lastTickAt, endMs, maximumSeconds = 30) {
  return Math.max(lastTickAt, endMs - maximumSeconds * 1000);
}
