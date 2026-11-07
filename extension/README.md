# SignalWell AI — Browser Extension

A Manifest V3 extension that records domain-level browser activity (which
sites, how long, how many sessions, late-night usage) and syncs it to your
SignalWell account. It never reads page contents, keystrokes, form data, or
messages, and it never holds the Supabase service-role key.

## What it collects

- The hostname of the active tab, while the browser is focused and not idle
  (`chrome.idle`, 60s threshold).
- Minutes per domain per day, bucketed by category (`config.js`'s
  `CATEGORY_MAP` — extend this list as needed).
- A "late-night" minute count for time between `LATE_NIGHT_START_HOUR` and
  `LATE_NIGHT_END_HOUR` (defaults: 11pm–5am, local browser time).
- A session/launch count per domain, app switches, and tracking coverage minutes.
- Local daily data carries its account ID; data recorded under one account will not sync under another.

## What it does not collect

Passwords, keystrokes, private messages, form contents, banking information,
personal files, or the contents of any webpage.

## Local development

1. Edit `config.js`:
   - `SUPABASE_URL` / `SUPABASE_ANON_KEY` — same values as the web app's
     `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - `API_BASE_URL` — where the Next.js app is running
     (`http://localhost:3000/api` for local dev).
   - `DASHBOARD_URL` — where the popup's "Open Dashboard" link should go.
2. In Chrome, go to `chrome://extensions`, enable Developer mode, choose
   "Load unpacked," and select this `extension/` folder.
3. Click the extension icon → it opens `options.html` when there's no session
   yet (or via the popup's "Privacy Settings" link) — log in with the same
   email/password as your SignalWell web account.
4. Tracking starts paused. Sign in, review the popup notice, and choose Resume tracking to opt in. It records only while a browser window is focused and Chrome reports active, not idle or locked. Choose Pause tracking at any time.
5. Browse normally. The background service worker checks activity every ~30 seconds
   (`chrome.alarms`, `tick`) and syncs to `/api/extension/sync` every
   `SYNC_INTERVAL_MINUTES` (default 15) or immediately after login.

## Production

- Update `host_permissions` in `manifest.json` to your production API origin
  (Manifest V3 does not allow wildcard `<all_urls>` host permissions without
  justification during Chrome Web Store review — scope this to your actual
  domain).
- Update `config.js` with production Supabase and API URLs before packaging.
- Package/sign for the Chrome Web Store per Google's standard extension
  publishing process — this repo does not include that packaging step.

## Auth model

The extension authenticates directly against Supabase's GoTrue REST endpoint
(`/auth/v1/token`) using the public anon key, exactly like the web app's
client-side Supabase client. The resulting access/refresh tokens are stored in
`chrome.storage.local`, scoped to the extension, and are never sent anywhere
except `API_BASE_URL` and `SUPABASE_URL`. `/api/extension/sync` on the server
re-validates that token before writing anything, and every write is still
subject to that same user's Row Level Security policies — the extension has no
elevated access beyond what the signed-in user already has in the web app.
