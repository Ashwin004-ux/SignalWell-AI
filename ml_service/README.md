# Local ML service

The dashboard calls the Python API from Next.js. Run the web app and this service in separate terminals. The API returns `unavailable` until a model has been trained from appropriately consented, participant-reported data.

## 1. Configure the local environment

The project root `.env.local` is read by both Next.js and the Python service. Set these server-only values there:

```dotenv
ML_SERVICE_URL=http://127.0.0.1:8000
MODEL_PATH=./ml_service/models
ML_TRAINING_TOKEN=<long random secret>
```

Keep `.env.local` private and do not add `ML_TRAINING_TOKEN` to any `NEXT_PUBLIC_` variable. The training token is checked using a constant-time comparison. Training is disabled with HTTP 503 if the token is missing. In production, prediction requests also validate the Supabase bearer token instead of only checking that an Authorization header exists.

## 2. Install Python dependencies (PowerShell)

From the project root:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r ml_service\requirements.txt
```

If `py` is not recognized, install Python 3.11 or newer and enable the installer option to add Python to PATH, then reopen PowerShell. If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal and activate again.

## 3. Train from labelled data

Prepare a CSV with at least 50 rows, feature columns supported by `feature_engineering.py`, and a `wellbeing_score` column (participant-reported values from 1 to 10). Do not use generated/demo labels as evidence of real-world model validity. Keep participant data private and ensure the records are authorized for this use.

```powershell
python ml_service\train_from_csv.py C:\path\to\consented-labelled-data.csv
```

The script writes `ml_service/models/production.joblib` and prints held-out evaluation metrics. It drops records without a valid target instead of imputing wellbeing labels. If you do not yet have consented labelled records, skip training; the app should keep showing ML as unavailable rather than fabricate a model.

## 4. Run both servers

Terminal 1, project root:

```powershell
npm run dev
```

Terminal 2, project root:

```powershell
\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --app-dir ml_service --reload --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/` and confirm `production_model_loaded` is `true`. Then sign into the web app and run its analysis. Restart Next.js after changing `.env.local` so it reloads `ML_SERVICE_URL`.

## Training API security

`POST /api/ml/train` now requires `Authorization: Bearer <ML_TRAINING_TOKEN>`. Do not expose this endpoint to the public internet; prefer the local CSV command for controlled training. Keep the token only in server-side environment configuration and rotate it if it is disclosed. Model training is a privileged operation because it replaces the inference artifact.


## 30-day synthetic research demo

The research demo reads the versioned fixture at `ml_service/data/research_demo_v1.json`; it does not write demo observations into Supabase or live account tables. It contains three illustrative profiles with 30 consecutive dates (2026-08-01 through 2026-08-30). Regenerate the same fixture with `python ml_service\generate_demo_dataset.py` from the project root.

The generator uses fixed seed `731942`, profile-level starting values, simulated day-to-day variation, and explicit formulas linking some simulated screen, sleep, stress, mood, energy, and wellbeing values. These choices are assumptions for exercising software paths, not empirical findings or evidence that the factors cause each other. The `wellbeing_score` is a synthetic reference label, not a participant-reported clinical measure. Small fixture-trained metrics and predictions are for pipeline smoke testing only; they do not establish real-world model accuracy or clinical validity.

The research demo assistant receives only the selected synthetic profile and requested 7- or 30-day window. If the LLM provider is unavailable, it marks a limited supported calculation as a computed fallback and reports unsupported questions as unavailable. It never silently presents those calculations as LLM output. The authenticated live-user assistant remains a separate feature.
