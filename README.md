# SignalWell AI

**Understand your digital habits. Understand your wellbeing.**

SignalWell AI records screen time, sleep, and self-reported mood side by side, and
uses AI analysis to help you see how they relate. It is a wellbeing and research
tool — **not a medical diagnostic system**, and it does not diagnose depression,
anxiety disorders, or other mental illnesses.

This README documents what's actually built. See `docs/ROADMAP.md` for what's
planned next — the project is being built in honest phases rather than faked
end-to-end.

## Project overview

- **Frontend/backend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS.
- **Database/auth:** Supabase (PostgreSQL, Auth, Row Level Security).
- **Extension:** a Manifest V3 browser extension collecting domain-level
  browser activity, authenticated as the signed-in user.
- **AI:** designed around a provider-agnostic AI service abstraction (see
  `docs/ROADMAP.md` Phase 3) — not yet implemented in this pass.

## Architecture

```
Browser extension ──▶ /api/extension/sync ──▶ Supabase (RLS-scoped insert)
                                                     │
Web app forms      ──▶ /api/mood, /api/sleep ──▶────┤
                                                     ▼
                                          daily_activity, sleep_records,
                                          mood_records, application_usage
                                                     │
                                     (Phase 2/3 — not yet implemented)
                                                     ▼
                                   Aggregation ──▶ AI analysis ──▶ ai_analysis
                                                     │
                                                     ▼
                                     Dashboard, Insights, Notifications
```

Every table is isolated per user with Supabase Row Level Security — see
`supabase/policies.sql`. The Supabase **service-role key** is used in exactly
two places, both server-only: `src/lib/supabase/server.ts`'s
`createServiceRoleClient()` (used by `/api/settings/delete-account`) and
nowhere in the browser bundle or the extension.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in real values, see below
npm run dev
```

Requires Node 18+.

## Environment variables

See `.env.example`. Summary:

| Variable | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend + backend | Safe to expose in the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend + backend | Safe to expose — RLS is the real protection |
| `NEXT_PUBLIC_APP_URL` | Frontend + backend | Used for metadata, redirects, sitemap |
| `NEXT_PUBLIC_API_URL` | Extension | Where the extension posts sync data |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only | **Never** expose to the browser or extension |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL_NAME` | Backend only | Consumed by `src/lib/ai/` — see AI setup below |

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` against it (SQL Editor, or `supabase db push` if
   you're using the Supabase CLI with migrations).
3. Run `supabase/policies.sql` — **do not skip this**; without it, RLS is
   enabled with no policies, which blocks all access rather than protecting it.
4. In Authentication settings, enable Email/Password sign-in. Email
   confirmation is expected by the signup flow (`emailRedirectTo` in
   `src/app/(auth)/signup/page.tsx`).
5. Copy the project URL and anon key into `.env.local`.

## AI setup

The AI layer is implemented (`src/lib/ai/`) behind a provider-agnostic
interface. Set:

- `AI_PROVIDER=anthropic` (currently the only implemented provider)
- `AI_API_KEY` — your Anthropic API key
- `AI_MODEL_NAME` — defaults to `claude-sonnet-4-5` if unset

`getAiProvider()` in `src/lib/ai/index.ts` is the one place `AI_PROVIDER` is
read — adding a second provider means adding a new file under
`src/lib/ai/providers/` that implements the `AiProvider` interface and a new
`case` in that factory switch. Every `ai_analysis` row records which
`model_name` produced it.

The crisis/safety check in `src/lib/ai/safety.ts` runs before any model call
and does not depend on this configuration — review its keyword list and
resource text before relying on it in production (see `docs/ROADMAP.md`).

## Extension setup

See `extension/README.md`.

## Production deployment

- Deploy the Next.js app to any Node-compatible host (Vercel, etc.).
- Set all environment variables in the hosting platform — never commit
  `.env.local`.
- Point `NEXT_PUBLIC_APP_URL` at your real domain (used in metadata,
  `sitemap.ts`, and email redirect URLs).
- Update the extension's `config.js` and `manifest.json` `host_permissions`
  to the production API origin before packaging it for the Chrome Web Store.

## Custom domain

The app reads its own URL from `NEXT_PUBLIC_APP_URL` everywhere (metadata,
Open Graph, sitemap, email redirects) rather than hardcoding `localhost`, so
pointing a custom domain (e.g. `signalwell.ai`) at the deployment and setting
that one variable is sufficient on the app side. DNS/HTTPS configuration is
specific to your hosting provider.

## Security

- Row Level Security on every table (`supabase/policies.sql`).
- Service-role key confined to two server-only call sites (see Architecture).
- Every API route validates its input with `zod` before touching the database.
- Session cookies managed via `@supabase/ssr`; middleware refreshes sessions
  and protects `/dashboard/*`.
- The extension authenticates as the user (anon key + user credentials) —
  never with elevated access.

## What's built vs. what's a placeholder

Built and wired to real data: authentication, the dashboard shell, Overview
(reads live data), Mood and Sleep entry, Privacy & Data controls (toggles,
export, delete), the extension's tracking + sync + popup, landing page,
Privacy Policy / Terms (with `[PLACEHOLDER]` markers for legal review), SEO
basics, and favicon/branding.

Present in the nav but intentionally showing an honest "not built yet"
notice rather than fabricated data: Activity analytics, Insights, Assistant,
Notifications. See `docs/ROADMAP.md` for the phase each belongs to.

## Research Demo Mode

Open the /research-demo route while the Next.js app is running. It uses a versioned, fixed-seed synthetic fixture served by FastAPI; demo profile IDs start with demo-, and these endpoints do not read from or write to Supabase. The page supports 7-day and 30-day windows, coverage, daily trends, descriptive baselines and explicitly simulated rule alerts. Model inference is shown only when a compatible serialized model artifact exists. Synthetic values are not participant observations, clinical ground truth, or model evaluation data.

Run the backend from the repository root in one terminal: .\.venv\Scripts\python.exe -m uvicorn main:app --app-dir ml_service --reload --host 127.0.0.1 --port 8000. Run the frontend in a second terminal with npm run dev. The frontend proxy uses http://127.0.0.1:8000 by default; set ML_SERVICE_URL in .env.local only if the service runs elsewhere.

Backend checks: .\.venv\Scripts\python.exe -m pytest ml_service\tests -q. Frontend checks: npm run typecheck, npm run lint, and npm run build.

The extension now starts paused and requires sign-in plus an explicit Resume tracking choice. To persist the new daily tracking coverage column in an existing Supabase project, apply the idempotent tracking_coverage_minutes ALTER statement added to supabase/schema.sql before syncing from the extension.
