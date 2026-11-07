import { CONFIG } from "./config.js";
import { accountDay, boundedIntervalStart, localDateKey, splitInterval, trackingAllowed } from "./tracker-core.mjs";

let trackingPaused = true;
let windowFocused = false;
let currentDomain = null;
let lastTickAt = Date.now();
let currentIdleState = "unknown";

function categoryFor(domain) {
  const bare = domain.replace(/^www\./, "");
  return CONFIG.CATEGORY_MAP[bare] ?? "other";
}
async function getState() {
  const { activity } = await chrome.storage.local.get("activity");
  return activity ?? {};
}
async function setState(activity) { await chrome.storage.local.set({ activity }); }
async function currentSession() {
  const { session } = await chrome.storage.local.get("session");
  return session?.user?.id ? session : null;
}
function domainFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.hostname : null;
  } catch { return null; }
}
async function recordElapsed(domain, startMs, seconds, session) {
  if (!domain || seconds <= 0) return;
  const activity = await getState();
  const segments = splitInterval(startMs, seconds, CONFIG.LATE_NIGHT_START_HOUR, CONFIG.LATE_NIGHT_END_HOUR);
  for (const segment of segments) {
    const bucket = accountDay(activity, segment.date, session.user.id);
    if (!bucket) continue;
    bucket.sites[domain] ??= { minutes: 0, seconds: 0, launches: 0, category: categoryFor(domain) };
    bucket.sites[domain].seconds += segment.seconds;
    bucket.totalSeconds += segment.seconds;
    bucket.coverageSeconds += segment.seconds;
    bucket.lateNightSeconds = Math.min(bucket.totalSeconds, bucket.lateNightSeconds + segment.lateNightSeconds);
    while (bucket.sites[domain].seconds >= 60) {
      bucket.sites[domain].minutes += 1;
      bucket.sites[domain].seconds -= 60;
    }
  }
  await setState(activity);
}
async function tick() {
  const endMs = Math.floor(Date.now() / 1000) * 1000;
  const startMs = boundedIntervalStart(lastTickAt, endMs, 30);
  const elapsedSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  lastTickAt = endMs;
  const session = await currentSession();
  if (!trackingAllowed({ optedIn: !trackingPaused, focused: windowFocused, idleState: currentIdleState, accountId: session?.user?.id })) return;
  await recordElapsed(currentDomain, startMs, elapsedSeconds, session);
}
async function noteNewSession(domain) {
  const session = await currentSession();
  if (!domain || !session || trackingPaused || !windowFocused) return;
  const activity = await getState();
  const bucket = accountDay(activity, localDateKey(Date.now()), session.user.id);
  if (!bucket) return;
  bucket.sites[domain] ??= { minutes: 0, seconds: 0, launches: 0, category: categoryFor(domain) };
  bucket.sites[domain].launches += 1;
  bucket.appSwitches += 1;
  await setState(activity);
}
async function updateCurrentDomainFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const domain = tab?.url ? domainFromUrl(tab.url) : null;
  if (domain && domain !== currentDomain) await noteNewSession(domain);
  currentDomain = domain;
}
async function getValidAccessToken() {
  const session = await currentSession();
  if (!session) return null;
  if (session.expires_at > Date.now() + 60000) return session.access_token;
  const res = await fetch(CONFIG.SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CONFIG.SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  if (!res.ok) { await chrome.storage.local.remove("session"); return null; }
  const data = await res.json();
  const nextSession = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + data.expires_in * 1000, user: session.user };
  await chrome.storage.local.set({ session: nextSession });
  return nextSession.access_token;
}
async function syncPending(onlyToday = false) {
  const token = await getValidAccessToken();
  if (!token) return;
  const session = await currentSession();
  if (!session) return;
  const activity = await getState();
  for (const [storageKey, bucket] of Object.entries(activity)) {
    if (bucket.ownerId !== session.user.id || !bucket.sites) continue;
    // Buckets are keyed by userId::date to prevent accounts sharing local
    // browser storage from seeing one another's data. The API needs the date
    // inside the bucket, never the storage key.
    const date = bucket.date ?? storageKey.split("::").pop();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) continue;
    if (onlyToday && date !== localDateKey(Date.now())) continue;
    const sites = Object.entries(bucket.sites).map(([domain, site]) => ({ domain, category: site.category, usage_minutes: site.minutes, launch_count: site.launches }));
    const totalMinutes = Math.floor((bucket.totalSeconds ?? 0) / 60);
    const lateNightMinutes = Math.min(totalMinutes, Math.floor((bucket.lateNightSeconds ?? 0) / 60));
    // Older local buckets predate coverageSeconds; their collected duration
    // is the best available estimate of tracking coverage.
    const coverageSeconds = bucket.coverageSeconds ?? bucket.totalSeconds ?? 0;
    const coverageMinutes = Math.min(1440, Math.floor(coverageSeconds / 60));
    try {
      const response = await fetch(CONFIG.API_BASE_URL + "/extension/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ date, sites, late_night_usage_minutes: lateNightMinutes, notifications_count: 0, app_switches: bucket.appSwitches ?? 0, tracking_coverage_minutes: coverageMinutes })
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.details || errorBody.error || `Server returned ${response.status}.`);
      }
      await chrome.storage.local.set({ lastSyncAt: Date.now(), lastSyncStatus: "ok", lastSyncError: "" });
    } catch (error) {
      await chrome.storage.local.set({
        lastSyncStatus: "error",
        lastSyncError: error instanceof Error ? error.message : "The sync request failed."
      });
    }
  }
}
async function handlePauseMessage(paused) {
  if (!paused && !(await currentSession())) return { ok: false, error: "Sign in before enabling tracking." };
  if (paused) await tick();
  trackingPaused = Boolean(paused);
  await chrome.storage.local.set({ trackingPaused });
  if (!trackingPaused) await updateCurrentDomainFromActiveTab();
  await syncPending(true);
  return { ok: true, trackingPaused };
}
chrome.tabs.onActivated.addListener(async () => { await tick(); await updateCurrentDomainFromActiveTab(); });
chrome.tabs.onUpdated.addListener(async (_id, changeInfo, tab) => {
  if (changeInfo.url && tab.active) { await tick(); await updateCurrentDomainFromActiveTab(); }
});
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await tick();
  windowFocused = windowId !== chrome.windows.WINDOW_ID_NONE;
  if (windowFocused) await updateCurrentDomainFromActiveTab();
  else currentDomain = null;
});
chrome.idle.onStateChanged.addListener(async (state) => {
  await tick();
  currentIdleState = state;
  if (state === "active") await updateCurrentDomainFromActiveTab();
});
chrome.alarms.create("tick", { periodInMinutes: 0.5 });
chrome.alarms.create("sync", { periodInMinutes: CONFIG.SYNC_INTERVAL_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tick") void tick();
  if (alarm.name === "sync") void syncPending();
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SET_TRACKING_PAUSED") { handlePauseMessage(message.paused).then(sendResponse); return true; }
  if (message.type === "SESSION_UPDATED") {
    trackingPaused = true;
    void chrome.storage.local.set({ trackingPaused: true });
    void syncPending();
  }
  if (message.type === "SYNC_PENDING") {
    syncPending(true).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  if (message.type === "GET_TODAY_SUMMARY") {
    Promise.all([getState(), currentSession()]).then(([activity, session]) => {
      const date = localDateKey(Date.now());
      const accountKey = session ? `${session.user.id}::${date}` : null;
      const bucket = (accountKey && activity[accountKey]) || activity[date] ||
        Object.values(activity).find((item) => item.ownerId === session?.user?.id && item.date === date);
      const ownedBucket = bucket?.ownerId === session?.user?.id ? bucket : null;
      const sites = Object.values(ownedBucket?.sites ?? {});
      const totalMinutes = Math.floor((ownedBucket?.totalSeconds ?? 0) / 60);
      const coverageSeconds = ownedBucket?.coverageSeconds ?? ownedBucket?.totalSeconds ?? 0;
      sendResponse({
        totalMinutes,
        socialMinutes: sites.filter((site) => site.category === "social_media").reduce((sum, site) => sum + site.minutes, 0),
        lateNightMinutes: Math.min(totalMinutes, Math.floor((ownedBucket?.lateNightSeconds ?? 0) / 60)),
        trackingCoverageMinutes: Math.floor(coverageSeconds / 60),
        optedIn: !trackingPaused
      });
    });
    return true;
  }
});
chrome.storage.local.get("trackingPaused").then(async ({ trackingPaused: paused }) => {
  trackingPaused = paused === undefined ? true : Boolean(paused);
  if (paused === undefined) await chrome.storage.local.set({ trackingPaused: true });
  const lastFocused = await chrome.windows.getLastFocused();
  windowFocused = Boolean(lastFocused?.focused);
  currentIdleState = await chrome.idle.queryState(60);
  lastTickAt = Date.now();
  if (windowFocused) await updateCurrentDomainFromActiveTab();
});
