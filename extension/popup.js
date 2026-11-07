import { CONFIG } from "./config.js";

const totalMinutesEl = document.getElementById("totalMinutes");
const socialMinutesEl = document.getElementById("socialMinutes");
const lateNightMinutesEl = document.getElementById("lateNightMinutes");
const statusText = document.getElementById("statusText");
const connectionPill = document.getElementById("connectionPill");
const trackingState = document.getElementById("trackingState");
const trackingIndicator = document.getElementById("trackingIndicator");
const accountEmail = document.getElementById("accountEmail");
const pauseBtn = document.getElementById("pauseBtn");
const dashboardLink = document.getElementById("dashboardLink");
const settingsLink = document.getElementById("settingsLink");
const signedOutNote = document.getElementById("signedOutNote");
const coverageEl = document.getElementById("trackingCoverageMinutes");
const coverageTrack = document.querySelector(".coverage-track");
const coverageFill = document.getElementById("coverageFill");

function formatMinutes(minutes) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

dashboardLink.href = CONFIG.DASHBOARD_URL;
settingsLink.href = chrome.runtime.getURL("options.html");
settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

async function render(syncNow = true) {
  const { session, trackingPaused, lastSyncStatus, lastSyncAt, lastSyncError } = await chrome.storage.local.get([
    "session",
    "trackingPaused",
    "lastSyncStatus",
    "lastSyncAt",
    "lastSyncError"
  ]);

  const synced = lastSyncStatus === "ok" && lastSyncAt && Date.now() - lastSyncAt < 60 * 60 * 1000;
  signedOutNote.style.display = session ? "none" : "block";
  accountEmail.textContent = session?.user?.email ? `Sync account: ${session.user.email}` : "";
  connectionPill.classList.remove("connected", "paused", "disconnected", "error");
  trackingIndicator.classList.remove("active", "paused");

  if (!session) {
    connectionPill.classList.add("disconnected");
    statusText.textContent = "Not signed in";
    trackingState.textContent = "Sign in to sync your activity";
  } else if (lastSyncStatus === "error") {
    connectionPill.classList.add("error");
    statusText.textContent = "Sync issue";
    trackingIndicator.classList.add(trackingPaused ? "paused" : "active");
    trackingState.textContent = `Sync failed: ${lastSyncError || "request failed"}`;
  } else if (trackingPaused) {
    connectionPill.classList.add("paused");
    statusText.textContent = "Paused";
    trackingIndicator.classList.add("paused");
    trackingState.textContent = "Tracking is paused";
  } else {
    if (synced) connectionPill.classList.add("connected");
    statusText.textContent = synced
      ? `Synced ${new Date(lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "Waiting to sync";
    trackingIndicator.classList.add("active");
    trackingState.textContent = "Browser activity tracking is on";
  }

  pauseBtn.textContent = trackingPaused ? "Resume tracking" : "Pause tracking";
  pauseBtn.setAttribute("aria-pressed", String(Boolean(trackingPaused)));

  chrome.runtime.sendMessage({ type: "GET_TODAY_SUMMARY" }, (summary) => {
    if (!summary) return;
    totalMinutesEl.textContent = formatMinutes(summary.totalMinutes);
    socialMinutesEl.textContent = formatMinutes(summary.socialMinutes);
    lateNightMinutesEl.textContent = formatMinutes(summary.lateNightMinutes);
    const coverageMinutes = Math.min(1440, Math.max(0, Number(summary.trackingCoverageMinutes) || 0));
    coverageEl.textContent = formatMinutes(coverageMinutes);
    coverageFill.style.width = `${(coverageMinutes / 1440) * 100}%`;
    coverageTrack.setAttribute("aria-valuenow", String(coverageMinutes));
  });

  if (syncNow) {
    chrome.runtime.sendMessage({ type: "SYNC_PENDING" }, () => {
      if (!chrome.runtime.lastError) void render(false);
    });
  }
}

pauseBtn.addEventListener("click", async () => {
  const { trackingPaused } = await chrome.storage.local.get("trackingPaused");
  const next = !trackingPaused;
  chrome.runtime.sendMessage({ type: "SET_TRACKING_PAUSED", paused: next }, (response) => {
    if (response?.ok) render();
    else {
      trackingState.textContent = response?.error || "Could not change tracking state.";
      trackingIndicator.classList.remove("active", "paused");
    }
  });
});

render();
