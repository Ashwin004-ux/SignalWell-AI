# SignalWell AI — Project Report

**Project:** SignalWell AI — Digital Wellbeing Tracking and Research Demo  
**Report prepared:** 21 October 2026  
**Application folder:** `C:\Users\ASUS\Documents\signalwell-ai-2`  
**Project status:** Working application with a live-account product path and a separate synthetic research/demo path. Some operational integrations require external configuration.

## 1. Executive summary

SignalWell AI is a web application for recording and reviewing relationships between browser activity, sleep, and self-reported wellbeing measures. It includes a Chrome Manifest V3 extension for opt-in domain-level browser activity tracking; authenticated account features for activity, mood, sleep, insights, notifications, privacy, and an assistant; and a separate research demo using fixed, reproducible synthetic observations.

The product is a wellbeing tracking and research tool. It is not a medical service, diagnostic system, or substitute for professional care. The research demo is intentionally isolated from Supabase and must not be interpreted as participant research data or clinical evidence.

## 2. Project goals

- Help users see their digital activity alongside self-reported mood and sleep records.
- Collect browser activity only after a user signs in and explicitly resumes tracking.
- Provide per-account data isolation, privacy controls, and data export/deletion paths.
- Show day-level trends and transparent summaries where data exists, with honest empty states where it does not.
- Exercise analytics, assistant, and ML workflows safely using a reproducible synthetic dataset.
- Keep descriptive associations distinct from causal or clinical claims.

## 3. Technology stack

| Area | Technology |
|---|---|
| Web application | Next.js 14 App Router, React 18, TypeScript |
| Styling and UI | Tailwind CSS, project UI components, Lucide icons |
| Charts | Recharts |
| Live authentication and database | Supabase Auth and PostgreSQL, with Row Level Security (RLS) |
| Browser collection | Chrome Manifest V3 extension, JavaScript service worker and Chrome APIs |
| Research demo API | Python FastAPI in `ml_service/` |
| ML and data processing | Python, pandas, scikit-learn and XGBoost (where installed/configured), joblib serialization |
| LLM integration | Provider abstraction in `src/lib/ai/`; separate Python LLM helper for the demo assistant |
| Validation and tests | Zod, Pydantic, pytest, Node test runner, TypeScript and ESLint |

## 4. Application architecture

```text
LIVE ACCOUNT DATA PATH
Chrome extension ──┐
                    ├── Next.js API routes ── Supabase Auth/PostgreSQL + RLS
Web forms ─────────┘                             │
                                                ├── Live dashboard
                                                ├── AI insights and assistant
                                                └── Rule-based notifications

ISOLATED RESEARCH DEMO PATH
Research demo page ── Next.js proxy ── FastAPI research-demo router
                                                │
                                                ├── Versioned JSON fixture
                                                ├── Descriptive analysis / simulated alerts
                                                └── Optional compatible serialized ML model
```

The research-demo fixture has its own `demo-*` profile identifiers and API routes. It does not load from or write to Supabase. The live account path remains Supabase-backed. A Python FastAPI service also contains the ML endpoints and training pipeline; ML predictions remain unavailable when a valid compatible artifact is not present.

## 5. Implemented application features

### 5.1 Public and account pages

- Public landing page with product information and non-medical disclaimer.
- Sign-up, sign-in, and password reset flows using Supabase Auth.
- Protected dashboard routes with account session handling.
- Terms and privacy pages; legal/business text may contain placeholders that need review before public launch.

### 5.2 Live user dashboard

- **Overview:** shows available current activity, mood, previous-night sleep, and latest stored wellbeing summary.
- **Activity:** browser-extension activity trends, social-media trends, category breakdown, and recent averages; includes insufficient-data states.
- **Mood:** self-reported mood, stress, anxiety, energy/wellbeing measures and history.
- **Sleep:** sleep-duration and sleep-quality entry and history.
- **Insights:** displays generated analysis records and a user-triggered generation action.
- **Assistant:** authenticated chat UI with saved conversations and messages; activity context can be governed by the user setting.
- **Notifications:** threshold-based notifications with read state and a manual check action; daily scheduled routes are also present.
- **Privacy & Data / Settings:** data collection and assistant/analytics/notification controls, account/profile settings, data export, and account deletion paths.

The live experience depends on valid Supabase project configuration, schema, RLS policies, and any required migration being applied. Empty screens can be expected when a new account has not entered data or connected the extension.

### 5.3 Browser extension

The extension is an opt-in Manifest V3 browser tracker. Its documented behavior includes:

- Starts paused; the user signs in and chooses **Resume tracking** explicitly.
- Tracks the active tab hostname/domain and duration while Chrome is focused and reports the user as active.
- Categorizes domain time and tracks daily totals such as screen minutes, social media, late-night usage, sessions/app switches, and tracking coverage.
- Syncs to the Next.js extension API using the user's own Supabase authentication, not an elevated service-role key.
- Supports pause/resume and account-aware local records.
- Does not read page contents, keystrokes, form values, private messages, passwords, or personal files.

It records browser activity only; it is not device-wide screen-time monitoring. Chrome extension installation, API origin, Supabase values, and database schema must be configured for use.

### 5.4 Research Demo Mode

Available at `/research-demo` while the Next.js app is running and the FastAPI service is available.

- Three named synthetic profiles, each with 30 consecutive daily observations.
- Fixed seed `731942` and a checked-in, versioned fixture at `ml_service/data/research_demo_v1.json`.
- Selectable 7-day and 30-day windows, profile selection, coverage indicators, daily observation table, charts, descriptive baselines and simulated rule alerts.
- An assistant scoped to the currently selected synthetic profile/window. If an LLM provider is unavailable, supported deterministic calculations are labeled as computed fallbacks; unsupported questions are explicitly marked unavailable.
- Model inference appears only when a compatible trained regression artifact is present. No random or canned prediction is substituted when the artifact is missing.
- Demo LLM instructions and request context are separate from the live authenticated assistant.

The fixture has generated activity and wellbeing reference values. Its formulas intentionally encode assumptions and simulated variation to exercise software paths; these are not empirical findings, real participant observations, clinical ground truth, or evidence of causation.

## 6. Data captured and database model

The Supabase schema defines account-linked tables including:

- `profiles` — account profile and timezone.
- `daily_activity` — per-user daily aggregates, category minutes, late-night usage, notifications, app switches, and tracking coverage.
- `application_usage` — category/application or domain-level usage records.
- `sleep_records` — daily sleep information and quality fields.
- `mood_records` — self-reported mood, stress, anxiety, wellbeing, energy, and notes.
- `ai_analysis` — generated summaries, indicators, confidence, contributing factors, recommendations, and model metadata.
- `chatbot_conversations` and `chatbot_messages` — authenticated assistant conversation history.
- `notifications` — generated rule-based notices and read status.
- `user_settings` and `extension_devices` — user preferences and extension tracking state.

Tables are linked to authenticated Supabase users. The schema and RLS policy scripts are in `supabase/`. Apply the schema and policies to the target Supabase project before relying on the live-account functionality. Existing installations may also need the `tracking_coverage_minutes` migration included in the schema.

## 7. Analytics, AI, and ML behavior

### Live AI features

- The TypeScript AI abstraction is in `src/lib/ai/`; it has provider implementations for Anthropic, OpenAI, and Ollama in the current source tree.
- Analysis is built from a bounded data window instead of sending raw database tables wholesale.
- The prompt and safety helpers are designed to avoid diagnosis and distinguish data observations from interpretation.
- Notifications use deterministic threshold rules rather than claiming to be AI predictions.
- The crisis/safety keyword handling is a functional safeguard, not a clinically validated risk instrument; its wording, localization, and handling require expert review before real-world reliance.

### Python ML service

- The `ml_service/` pipeline validates and preprocesses data, performs a held-out evaluation, and trains supported regression/classification model candidates.
- The wellbeing research demo uses regression for continuous wellbeing scores. A missing, corrupt, or incompatible production artifact is reported as unavailable.
- Training through `POST /api/ml/train` requires the server-side `ML_TRAINING_TOKEN`; do not expose this endpoint publicly without appropriate access controls.
- The synthetic fixture smoke test trains into a temporary directory, reloads the serialized artifact, and runs a prediction. It does not install a production model.
- Fixture metrics only confirm software execution. They do not establish real-world predictive performance, fairness, clinical validity, or utility.

## 8. Privacy, security, and safety design

- Supabase RLS is the primary database boundary between users; apply and review `supabase/policies.sql` together with the schema.
- The extension uses user authentication and does not carry the service-role key.
- The service-role key must remain server-side and be restricted to privileged server actions such as account deletion or controlled analysis writes.
- API inputs are validated at route boundaries; authentication and settings checks are used on live-user routes.
- The extension requires explicit opt-in and can be paused.
- The research demo is separate from account data and does not persist synthetic observations to Supabase.
- Wellbeing language must remain non-diagnostic. The application is not an emergency or crisis care service.
- Secrets are intentionally not included in this report. Configure local values in `.env.local` and other server environment files; never commit or publish them.

## 9. Running locally

Run commands from the project root: `C:\Users\ASUS\Documents\signalwell-ai-2`.

### Web application

```powershell
npm install
npm run dev
```

The web application normally opens at `http://localhost:3000`.

### Research demo / Python API

In a second terminal from the same project root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir ml_service --reload --host 127.0.0.1 --port 8000
```

The Next.js proxy uses `http://127.0.0.1:8000` by default; set the server-only `ML_SERVICE_URL` in `.env.local` if the API uses another address. A compatible model file is not required for the charts, synthetic analysis, or deterministic assistant fallback. Model inference remains unavailable without a compatible artifact.

### Environment and external setup

- Set Supabase URL and public anon key for web authentication and live data access.
- Set the matching server-side values needed by the Python API where applicable.
- Configure AI provider and API credentials only if using a hosted LLM provider; keep these server-side.
- Configure cron secrets and a scheduler if deploying scheduled insight/notification jobs.
- Load the unpacked extension in Chrome Developer Mode and set the extension's API and Supabase origins before use.
- Do not copy actual credentials into a report or source control.

## 10. Verification record

The latest recorded implementation checks for the synthetic research-demo work completed on 20 October 2026:

| Check | Result |
|---|---|
| Python ML and research-demo suite | 18 tests passed, including assistant profile/window scoping and synthetic train/save/reload/predict smoke test |
| Frontend TypeScript typecheck | Passed |
| Frontend ESLint | Passed |
| Next.js production build | Passed; `/research-demo` and API proxy routes included |

The Python suite emitted one pandas compatibility warning from preprocessing's dtype selection; it did not fail the test suite. A real external LLM response was not verified as part of those checks. Supabase services, deployed cron schedules, production data, and Chrome Web Store publishing require separate environment-backed verification.

The repository also contains `SIGNALWELL_TEST_REPORT.md`, an earlier test/debug report dated 10 October 2026. Treat its date and test counts as historical; use the latest run above for the synthetic-demo changes.

## 11. Current limitations and work to review

- This is a wellbeing tracker, not a medical product or validated mental-health assessment tool.
- Browser measurements are domain-level activity from the extension, not whole-device screen time.
- Manual sleep and mood data depend on users entering them accurately and consistently.
- Synthetic demo values and fixture-trained model metrics are illustrative only.
- Live functionality depends on external Supabase setup, correct schema/RLS, environment configuration, and user consent.
- The external LLM integration requires a configured provider and network/API access; fallback behavior should remain transparent.
- Crisis language and legal terms/privacy statements need appropriate professional and jurisdiction-specific review.
- The local in-memory rate limiter is not a shared limit across multiple production instances; production scaling requires an appropriate shared store.
- The extension needs live browser/account simulation and production-origin review before distribution.
- ML training must use properly authorized, relevant, participant-reported data for any meaningful real-world evaluation; a small synthetic dataset is not adequate.

## 12. What is distinctive about SignalWell AI

1. **Combines multiple self-tracking signals:** browser-domain activity, sleep, mood, stress, anxiety, movement, and wellbeing are viewable together over daily timelines.
2. **Privacy-aware browser collection:** explicit opt-in, pause/resume, user-authenticated sync, and no collection of page contents or keystrokes.
3. **Separates a reproducible demo from real accounts:** the synthetic research mode can be evaluated without inserting demo records into the live user database.
4. **Makes data limitations visible:** supports daily records, 7/30-day windows, coverage reporting, missing/insufficient-data states, and labels simulated alerts and reference scores.
5. **Separates computation layers:** rule-based alerts, optional statistical predictions, and natural-language explanations are distinct; language does not overwrite numerical model output.
6. **Avoids clinical framing:** the product presents patterns for reflection and does not claim to diagnose or establish causation.

These are design and implementation distinctions, not claims of clinical effectiveness or superiority over other products.

## 13. Important project files

| File or folder | Purpose |
|---|---|
| `src/app/` | Web routes, dashboard pages, API endpoints |
| `src/components/` | Dashboard, forms, charts, assistant and demo UI |
| `src/lib/ai/` | Live AI provider interface, prompts, data window and safety helpers |
| `src/lib/supabase/` | Server/browser Supabase clients |
| `supabase/schema.sql` | PostgreSQL tables, indexes, constraints and triggers |
| `supabase/policies.sql` | RLS policies |
| `extension/` | Browser extension manifest, tracking, popup, options, tests and docs |
| `ml_service/main.py` | FastAPI entry point for the Python service |
| `ml_service/research_demo.py` | Isolated synthetic demo API, analysis, assistant and prediction routes |
| `ml_service/pipeline.py` | Python preprocessing, model training, evaluation and inference artifact loading |
| `ml_service/data/research_demo_v1.json` | Versioned 3-profile, 30-day synthetic fixture |
| `ml_service/tests/` | Python pipeline and research-demo tests |
| `docs/ROADMAP.md` | Project phase and further work notes |
| `SIGNALWELL_TEST_REPORT.md` | Historical test/debug report (10 October 2026) |

---

**Suggested report citation:** *SignalWell AI Project Report, prepared 21 October 2026, based on the application source and verification record in the project folder.*
