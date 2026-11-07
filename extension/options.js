import { CONFIG } from "./config.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const statusEl = document.getElementById("status");
const signedOutView = document.getElementById("signedOut");
const signedInView = document.getElementById("signedIn");
const signedInEmailEl = document.getElementById("signedInEmail");

function setStatus(message, kind) {
  statusEl.textContent = message ?? "";
  statusEl.className = kind ?? "";
}

async function refreshView() {
  const { session } = await chrome.storage.local.get("session");
  if (session?.user?.email) {
    signedOutView.style.display = "none";
    signedInView.style.display = "block";
    signedInEmailEl.textContent = session.user.email;
  } else {
    signedOutView.style.display = "block";
    signedInView.style.display = "none";
  }
}

/**
 * Authenticates directly against Supabase's GoTrue REST endpoint using only
 * the public anon key — the same credential pair the web app ships with the
 * NEXT_PUBLIC_ prefix. This never touches the service-role key, so a stolen
 * extension install can only ever act as the one signed-in user.
 */
async function login(email, password) {
  const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    throw new Error("We couldn't sign you in. Check your email and password.");
  }

  const data = await res.json();
  await chrome.storage.local.set({
    session: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      user: { id: data.user.id, email: data.user.email }
    }
  });
}

loginBtn.addEventListener("click", async () => {
  loginBtn.disabled = true;
  setStatus("Signing in…");
  try {
    await login(emailInput.value.trim(), passwordInput.value);
    setStatus("Signed in.", "ok");
    passwordInput.value = "";
    await refreshView();
    chrome.runtime.sendMessage({ type: "SESSION_UPDATED" });
  } catch (err) {
    setStatus(err.message ?? "Something went wrong.", "error");
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("session");
  setStatus("Logged out.", "ok");
  await refreshView();
  chrome.runtime.sendMessage({ type: "SESSION_UPDATED" });
});

refreshView();
