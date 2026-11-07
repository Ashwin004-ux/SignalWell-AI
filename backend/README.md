# SignalWell AI — Python backend (FastAPI + ML)

A separate Python service alongside the Next.js app, for machine-learning
model training/inference and (optionally, see below) the LLM analysis and
chatbot logic. This is new, additive infrastructure — it does not replace
the Next.js API routes, which remain fully functional on their own.

## What's actually been tested here, and what hasn't

This was built in a sandboxed environment with **no network access** and
only `pandas`, `numpy`, and `scikit-learn` pre-installed — `fastapi`,
`pydantic`, `uvicorn`, `xgboost`, `shap`, and `supabase` could not be
installed or executed. Given that constraint, here's exactly what was
verified and what wasn't:

**Actually run and verified correct, against synthetic test fixtures**
(see `tests/test_pipeline.py`, 9/9 passing):
- `app/ml/data/validation.py` — schema/range checks, the
  `MIN_ROWS_FOR_TRAINING` guard, duplicate-key handling
- `app/ml/data/features.py` — rolling features, and specifically confirmed
  **no target leakage** (a row's 7-day average never includes that row's
  own value)
- `app/ml/models/train.py` — Linear Regression, Random Forest Regressor,
  Logistic Regression, Random Forest Classifier all actually fit, cross-
  validate (grouped by user, never leaking a user across train/test), and
  evaluate correctly end-to-end
- `app/ml/models/registry.py` — model record construction and dataset
  fingerprinting
- `app/ml/predict.py` — graceful degradation when `shap` is unavailable
  (returns no explanation rather than a fabricated one)
- `scripts/train_wellbeing_model.py` — the full CLI, including the exact
  "Model evaluation requires sufficient research data." refusal path when
  given too little data (verified it exits 1 and trains nothing)
- `app/services/safety_service.py` — the crisis-keyword port, run against
  12 cases (9 should-trigger, 3 should-not, including a deliberate
  false-positive trap: "I killed it at the gym today")
- `app/services/notifications_service.py` — the rule-based notification
  port, including the minimum-prior-days guard
- `app/services/recommendations_service.py` — rule+model-driven
  recommendations: never empty, prioritizes rule-triggered over
  model-driven over generic fallback, deduplicates, respects a max count

**Written against documented APIs but NOT executed here** (no network to
install the packages):
- `app/ml/explain/shap_explain.py` — written against SHAP's documented
  `TreeExplainer`/`LinearExplainer` API; install `shap` and run against a
  real fitted model before trusting it
- The `xgboost` branches in `train.py` — same situation; they're skipped
  (not faked) when `xgboost` isn't installed, which is what you'll see if
  you run the CLI in this same sandbox
- Every FastAPI router and dependency, and the `supabase`-backed write/read
  calls inside `ml_prediction_service.py` — these need a real FastAPI
  install and a real Supabase project to verify.
- `llm_analysis_service.py`'s actual Anthropic API call (needs network + a
  real key) and `chatbot_service.py`'s wiring of that call — but
  `chatbot_service.py`'s crisis short-circuit could ALSO not be exercised
  directly here, because importing it pulls in `llm_analysis_service` ->
  `app.core.config`, which needs `pydantic_settings` (not installed, no
  network to add it). See `tests/test_chatbot_service.py`'s docstring for
  exactly what that leaves verified vs. not: the keyword check itself
  (`safety_service.py`) was fully tested directly; the one line of routing
  logic above it (if crisis: return fixed text, else: call provider) was
  not, for this dependency reason alone.

**Run `pytest` after installing `requirements.txt` before deploying
anything in this directory.**

## Architecture

```
backend/
  app/
    core/           # config, Supabase client factories, JWT verification
    api/
      deps.py        # auth dependencies (user session, cron secret)
      routers/
        ml.py         # IMPLEMENTED: prediction endpoints
    schemas/          # Pydantic response models
    ml/                # pure, I/O-free — data validation, feature engineering,
                        # training, explainability, inference
    services/          # the "separate backend services" the spec asked for:
      ml_prediction_service.py     # WRITTEN, UNTESTED: bridges ml/ to Supabase + Storage
      notifications_service.py     # TESTED: ported from the Next.js rules.ts
      recommendations_service.py   # TESTED: rule- and SHAP-driven, never generic-only
      safety_service.py            # TESTED: crisis-keyword port (12/12 cases)
      chatbot_service.py           # WRITTEN, UNTESTED: safety short-circuit + provider call
      llm_analysis_service.py      # WRITTEN, UNTESTED: provider abstraction + Anthropic call
  scripts/
    train_wellbeing_model.py     # CLI: validate -> features -> train -> evaluate -> (optionally) save
    export_training_data.sql     # pulls a flat training set out of Supabase
  tests/
    test_pipeline.py                   # 9/9 passing
    test_recommendations_service.py    # 4/4 passing
    test_chatbot_service.py            # crisis-keyword assertions pass; full-module
                                        # import untestable here, see its docstring
```

## What was intentionally NOT built in this pass

The product spec (Section 3) asked for this FastAPI backend to also
handle authentication, data ingestion, mood/sleep records, chatbot
requests, recommendations, and notifications end-to-end — i.e., to take
over everything the Next.js API routes currently do. That's a full
duplicate backend for ~15 routes' worth of business logic that already
exists, tested, in `../src/app/api/`. Rebuilding all of it a second time
in Python, at the same quality bar, in one pass wasn't realistic — doing
so quickly would have meant either much shallower code than the existing
Next.js routes, or claiming things were "done" that were never run.

**What exists instead:** the ML-specific pieces that have no Next.js
equivalent at all (training, prediction, explainability) are fully built
here. `notifications_service.py`, `recommendations_service.py`, and
`safety_service.py` are complete, independently tested ports — chosen
because their logic is pure (no I/O), so they could actually be verified
in this sandbox rather than just reviewed by eye. `chatbot_service.py` and
`llm_analysis_service.py` are written but, as explained above, their
provider-calling paths are unverified here.

**The architecture decision this leaves open:** do you want to (a) fully
migrate business logic to this FastAPI service and make Next.js a thinner
frontend that calls it, or (b) keep Next.js as the primary backend and use
this service only for ML training/inference (called from Next.js via
HTTP)? Option (b) is less work and is what the current `ml.py` router and
`vercel.json`/`cron.sql` scheduling assume implicitly, since those still
point at the Next.js `/api/cron/*` routes, not this service. Pick one
before porting anything further — running both with equivalent-but-
separate logic (as `notifications_service.py` and the Next.js
`rules.ts` currently are) is fine for comparison during development, but
not for production.

## Running locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real values
pytest                 # confirm the pipeline still passes in your environment
uvicorn app.main:app --reload --port 8000
```

## Training a real model

```bash
# 1. Run scripts/export_training_data.sql in the Supabase SQL editor,
#    export the result as CSV.
# 2. python scripts/train_wellbeing_model.py --input export.csv --task both
#    (add --save once you're ready to persist it to ml_models + Storage)
```

If the export has fewer than `MIN_ROWS_FOR_TRAINING` (150) valid rows, the
script prints "Model evaluation requires sufficient research data." and
exits without training or saving anything — this is enforced in code
(`app/ml/data/validation.py`), not just documented.
