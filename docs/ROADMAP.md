# SignalWell AI — Roadmap

This project is being built in phases so that every phase is real, working code —
no fabricated data, no mock dashboards standing in for the real thing.

## Phase 1 — Foundation (done)

- Supabase schema (`supabase/schema.sql`) for every table in the spec, with indexes,
  constraints, and an auto-create-profile-on-signup trigger.
- Row Level Security (`supabase/policies.sql`) isolating every table per user.
- Next.js 14 + TypeScript + Tailwind app scaffold with a restrained, non-templated
  design system (see `docs/DESIGN.md`).
- Real Supabase Auth: signup, login, logout, password reset, protected `/dashboard`
  routes via middleware.
- Dashboard shell: full navigation, mobile nav, Overview page reading live data
  from Supabase with honest empty states ("Not enough data yet").
- Mood and Sleep tracking: real forms → validated API routes → real inserts,
  scoped by RLS.
- Privacy & Data page: toggles bound to `user_settings`, a real data-export route,
  and a real account-deletion route.
- Landing page, Privacy Policy, and Terms & Conditions with the required
  disclaimers and clearly marked `[PLACEHOLDER]` spots for legal/business review.
- Browser extension (Manifest V3): domain-level activity tracking, idle-aware
  ticking, categorization, a popup showing today's screen time / social media /
  late-night usage, pause/resume, and a login flow that authenticates directly
  against Supabase Auth (never touches the service-role key).
- `/api/extension/sync`: accepts the user's own access token, writes into
  `application_usage` and `daily_activity` under that user's own RLS policies.
- SEO basics: metadata, Open Graph/Twitter tags, `robots.ts`, `sitemap.ts`,
  favicon and app icons, web manifest.

## Phase 2 — Analytics (in progress)

Done:
- `/dashboard/activity` — real trend chart (screen time, last 30 days), a
  social-media trend chart, a category breakdown bar chart (last 7 days), and
  7-day averages — all reading straight from `daily_activity`/`application_usage`,
  rendered only when there's enough real data, with honest "not enough data
  yet" states otherwise.
- `/dashboard/mood` — multi-series trend chart (mood/stress/anxiety/wellbeing,
  last 30 days) above the existing entry form and log.
- `/dashboard/sleep` — sleep-duration trend chart (last 30 days) above the
  existing entry form and log.

Still open:
- A scheduled daily aggregation job. Right now `/api/extension/sync` rolls
  per-sync `application_usage` rows up into that day's `daily_activity` row
  directly, which is correct for the extension's own data but doesn't repair
  or backfill days if a sync is missed, and doesn't yet fold in anything from
  outside the extension (e.g. a future mobile integration). A proper
  scheduled job (Supabase cron function or an external scheduler hitting a
  service-role route) should recompute `daily_activity` from
  `application_usage` for any date that needs it.
- Monthly view / longer date ranges beyond the current 30-day windows.

## Phase 3 — AI Analysis (done)

- AI service abstraction (`src/lib/ai/`): an `AiProvider` interface
  (`generateAnalysis`, `generateChatResponse`) with an Anthropic implementation
  (`providers/anthropic.ts`) and a factory (`getAiProvider()`) that reads
  `AI_PROVIDER`. Adding a second provider means writing one new file — no
  call site changes.
- `src/lib/ai/data-window.ts` builds a `WellbeingDataWindow` (14 days of
  activity/sleep/mood, plus prior-week averages) from real Supabase rows —
  never raw table dumps — and `hasEnoughDataForAnalysis()` gates generation
  so the model isn't asked to analyze 1-2 days of data.
- `src/lib/ai/prompt.ts` builds the structured prompt and a system prompt that
  explicitly forbids diagnostic language, requires hedged causal language,
  and requires the response to distinguish observed data from interpretation.
- `POST /api/insights/generate`: reads via the user's own session (respecting
  `analytics_enabled`), calls the provider, and writes the result via the
  service-role client — `ai_analysis` intentionally has no user-facing insert
  policy (see `supabase/policies.sql`), so this is the only path that can
  create a row there.
- `/dashboard/insights` displays real rows, each explicitly labeled "AI
  Insight," with a "Generate today's analysis" button since there's no
  scheduler in this environment yet (see Phase 5).

## Phase 4 — Assistant, Notifications, Safety (done)

- `POST /api/chat`: creates/continues a `chatbot_conversations` row, stores
  every message in `chatbot_messages`, and calls the same AI service
  abstraction. Pulls in the user's `WellbeingDataWindow` only when
  `chatbot_can_access_activity_data` is true and there's enough real data.
- Crisis/safety layer (`src/lib/ai/safety.ts`): a fixed, deterministic
  keyword/phrase check runs **before** any model call. When triggered, the
  model is bypassed entirely and a fixed, non-AI-generated resource message
  is returned — the model is never trusted to author crisis text live. The
  keyword list and resource text are explicitly marked as a starting point
  that needs review by someone with relevant expertise before production use.
- `/dashboard/assistant` is a real chat UI (`ChatPanel`) that loads the most
  recent conversation's history and posts new turns to `/api/chat`.
- Notification generation (`src/lib/notifications/rules.ts`): deliberately
  rule-based, not AI-generated — plain threshold comparisons against the
  user's own recent average, with messages that state the actual numbers
  ("your screen time today (3h 40m) is higher than your recent average
  (2h 50m)") rather than vague or alarming language.
  `POST /api/notifications/generate` runs these rules for the signed-in user,
  skips types already generated today, and respects `notifications_enabled`.
- `/dashboard/notifications` lists real rows with mark-as-read and a "Check
  for updates" button (same no-scheduler caveat as Insights).

## Phase 5 — Production hardening (in progress)

Done:
- **Scheduling.** Added `src/lib/jobs/daily-jobs.ts`, which holds the actual
  per-user insights/notifications logic once, shared by both the
  user-triggered buttons and two new scheduled entry points:
  `/api/cron/generate-insights` and `/api/cron/generate-notifications`.
  Both are authorized by a `CRON_SECRET` bearer token (never session-based),
  loop over every `profiles` row, and process each user independently so one
  user's failure doesn't block the rest. `vercel.json` wires these to run
  daily via Vercel Cron (which auto-attaches the `CRON_SECRET` header); for
  non-Vercel hosts, `supabase/cron.sql` sets up the same schedule via
  `pg_cron` + `pg_net` instead — use one or the other, not both. Each job is
  idempotent per user per day (insights upsert on `(user_id, date, period)`;
  notifications skip types already created today), so an accidental
  double-run is wasteful but not unsafe.
- Rate limiting already existed on `/api/chat`
  (`src/lib/rate-limit.ts` — an in-memory sliding window, explicitly
  documented as per-process only, not a substitute for Redis/Upstash in a
  multi-instance deployment); it's now also on the two user-triggered
  generate routes.

Still open:
- **Crisis-language review.** The keyword list and resource text in
  `src/lib/ai/safety.ts` are a functional starting point, not a reviewed
  clinical instrument — get this reviewed before real users rely on it, and
  localize the resources beyond the current US-centric defaults.
- Shared-store rate limiting (Redis/Upstash) if deployed across multiple
  server instances — the current limiter is per-process.
- CORS review, structured error logging.

## Phase 6 — Python ML pipeline + FastAPI backend (new, partial)

Added a separate `backend/` service (Python/FastAPI) per Section 37A of
the spec. Full detail, including an honest breakdown of what was actually
executed and verified vs. written-but-unrun, is in `backend/README.md` —
summary:

**Built and verified by actually running it** (no fabricated metrics;
9 + 4 passing tests, run against explicitly-synthetic fixtures only):
- Data validation, feature engineering (confirmed no target leakage),
  and training/evaluation for Linear Regression, Random Forest Regressor,
  Logistic Regression, and Random Forest Classifier, grouped by user so no
  user's data crosses the train/test boundary
- The `MIN_ROWS_FOR_TRAINING` (150 rows) guard, enforced in code — the CLI
  (`scripts/train_wellbeing_model.py`) was confirmed to print "Model
  evaluation requires sufficient research data." and exit without training
  anything when given too little data
- A content-based dataset fingerprint (`ml/models/registry.py`) so every
  saved model is traceable to exactly what data trained it
- Python ports of the crisis-keyword safety check (12/12 test cases,
  including a deliberate false-positive trap) and the rule-based
  notification/recommendation logic

**Written against documented APIs but not executable in the sandbox this
was built in** (no network access — `fastapi`, `pydantic`, `xgboost`,
`shap`, `httpx`, and `supabase` couldn't be installed): the XGBoost model
branches, SHAP explainability, every FastAPI router, and the
Supabase-backed persistence/prediction service. Run `pytest` after
`pip install -r backend/requirements.txt` before trusting any of this in
production.

**Deliberately not attempted:** fully re-implementing the existing Next.js
API routes (auth, ingestion, mood, sleep, settings, data export/deletion)
a second time in FastAPI. The spec asked for this backend to own all of
that; doing so at the same quality bar as the already-tested Next.js
routes wasn't realistic in the time available, and `backend/README.md`
spells out the open decision this leaves: migrate business logic into
FastAPI and make Next.js a thinner frontend, or keep Next.js primary and
use this service purely for ML training/inference over HTTP. Right now
the new Supabase `ml_models`/`ml_predictions` tables
(`supabase/ml_schema.sql`, `supabase/ml_policies.sql`) and
`export_training_data.sql` are the only parts of this backend that are
"load-bearing" for the rest of the app — everything else there is
additive and optional until that architecture call is made.
- Full accessibility pass (keyboard nav, ARIA, contrast) across all pages
  added in Phases 2-4.
- Research-export path: an anonymized, aggregate export separate from the
  per-user export in Privacy & Data (Section 36 of the spec).
- ML/LLM separation: a `predictions` table + feature-extraction step so a
  future custom model's output and the LLM's plain-language explanation of it
  are stored and displayed separately (Section 37 of the spec).
- Android integration architecture doc (no app — just the interfaces this web
  backend would need to expose).
- Actually running `npm install` and a real Supabase project against this
  code — this container has no network access, so everything above has been
  written and syntax/type-checked (`tsc`, `node --check`) but never executed
  against a live database or the Anthropic API. Test the flows listed in
  spec Section 44 before considering this production-ready.
