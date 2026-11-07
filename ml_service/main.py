import os
import hmac
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env.local")

from aggregation import completeness, merge_daily_features
from auth import bearer_token, get_user_id
from db import UserStore
from insights import build_insights, build_notifications
from llm import chat_reply, explain_prediction
from pipeline import (
    insufficient_message,
    load_production_bundle,
    predict_one,
    temporal_status,
    train_and_evaluate,
)
from recommendations import recommend_from_features
from research_demo import router as research_demo_router

APP_URL = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
_model_path = Path(os.getenv("MODEL_PATH", "./ml_service/models"))
MODEL_DIR = str(_model_path if _model_path.is_absolute() else (PROJECT_ROOT / _model_path).resolve())
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
ML_TRAINING_TOKEN = os.getenv("ML_TRAINING_TOKEN", "")

app = FastAPI(
    title="DLWA API",
    description="Backend for Digital Lifestyle and Wellbeing Analysis. Non-clinical. Separate ML and LLM layers.",
    version="1.0.0",
)

app.include_router(research_demo_router)

allow_origins = [APP_URL]
if ENVIRONMENT == "development":
    allow_origins.extend(["http://localhost:3000", "http://127.0.0.1:3000"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

_rate_buckets: dict[str, list[float]] = {}


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.url.path in ("/", "/health"):
        return await call_next(request)
    from time import time

    ip = request.client.host if request.client else "unknown"
    now = time()
    window = [t for t in _rate_buckets.get(ip, []) if now - t < 60]
    if len(window) >= 120:
        return JSONResponse({"detail": "Too many requests."}, status_code=429)
    window.append(now)
    _rate_buckets[ip] = window
    return await call_next(request)


class PredictRequest(BaseModel):
    user_id: Optional[str] = None
    features: Dict[str, Any]
    model_name: str = "production"


class TrainRequest(BaseModel):
    records: list[dict] = Field(default_factory=list, max_length=50000)
    task: str = "regression"
    run_ablation: bool = True


class LifestyleIn(BaseModel):
    date: str
    total_screen_time_minutes: int = Field(ge=0, le=1440)
    social_media_minutes: int = Field(ge=0, le=1440)
    late_night_usage_minutes: int = Field(ge=0, le=1440)
    sleep_duration_minutes: int = Field(ge=0, le=1440)
    physical_activity_minutes: int = Field(ge=0, le=1440)
    study_work_minutes: int = Field(ge=0, le=1440)
    notifications_count: int = Field(default=0, ge=0, le=10000)
    bedtime: Optional[str] = None
    wake_time: Optional[str] = None
    sleep_consistency_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    exercise_frequency: int = Field(default=0, ge=0, le=14)
    break_frequency: int = Field(default=0, ge=0, le=50)
    app_usage_notes: Optional[str] = Field(default=None, max_length=500)
    source: str = "manual"


class CheckinIn(BaseModel):
    date: str
    mood_score: Optional[int] = Field(default=None, ge=1, le=10)
    stress_score: Optional[int] = Field(default=None, ge=1, le=10)
    energy_score: Optional[int] = Field(default=None, ge=1, le=10)
    wellbeing_score: Optional[int] = Field(default=None, ge=1, le=10)
    reflection: Optional[str] = Field(default=None, max_length=1000)


class ConsentIn(BaseModel):
    research_consent: bool = False
    data_processing_consent: bool = False


class ProfileIn(BaseModel):
    full_name: Optional[str] = None
    timezone: Optional[str] = None


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class SettingsIn(BaseModel):
    notifications_enabled: Optional[bool] = None
    data_collection_enabled: Optional[bool] = None
    chatbot_enabled: Optional[bool] = None
    analytics_enabled: Optional[bool] = None
    timezone: Optional[str] = None


class SleepIn(BaseModel):
    date: str
    sleep_start: Optional[str] = None
    sleep_end: Optional[str] = None
    sleep_duration_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    sleep_quality: Optional[int] = Field(default=None, ge=1, le=10)
    interruptions: Optional[int] = Field(default=None, ge=0, le=100)


class MoodIn(BaseModel):
    date: str
    mood_score: Optional[int] = Field(default=None, ge=1, le=10)
    stress_score: Optional[int] = Field(default=None, ge=1, le=10)
    energy_score: Optional[int] = Field(default=None, ge=1, le=10)
    wellbeing_score: Optional[int] = Field(default=None, ge=1, le=10)
    reflection: Optional[str] = Field(default=None, max_length=1000)


class ActivitySyncIn(BaseModel):
    date: str
    totals: Dict[str, Any]
    domains: List[Dict[str, Any]] = Field(default_factory=list)


def store_dep(authorization: Optional[str] = Header(default=None)) -> UserStore:
    return UserStore(bearer_token(authorization))


@app.get("/")
def read_root():
    return {
        "status": "ok",
        "service": "DLWA API",
        "environment": ENVIRONMENT,
        "clinical": False,
        "temporal_models": temporal_status(),
        "production_model_loaded": load_production_bundle(MODEL_DIR) is not None,
        "layers": {"ml": "numerical estimates", "llm": "language only, never overrides ML"},
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/ml/predict")
async def predict(request: PredictRequest, authorization: Optional[str] = Header(default=None)):
    if ENVIRONMENT == "production":
        await get_user_id(authorization)
    result = predict_one(request.features, model_dir=MODEL_DIR)
    if result.get("status") != "ok":
        return {
            "status": "unavailable",
            "message": result.get("message") or insufficient_message(),
            "prediction": None,
        }
    explanation = explain_prediction(
        prediction=result.get("prediction"),
        shap_values=result.get("shap") or {},
        insights=[],
    )
    result["llm_explanation"] = explanation
    result["llm_overrides_ml"] = False
    return result


@app.get("/api/ml/explanation")
def get_explanation():
    bundle = load_production_bundle(MODEL_DIR)
    if bundle is None:
        return {"status": "unavailable", "message": insufficient_message()}
    return {
        "status": "ok",
        "global_feature_importance": bundle.get("feature_importance") or {},
        "language": "The model identified listed features as important in this estimate. This is not a causal claim.",
        "mode": bundle.get("mode"),
    }


@app.post("/api/ml/train")
def train(request: TrainRequest, authorization: Optional[str] = Header(default=None)):
    if not ML_TRAINING_TOKEN:
        raise HTTPException(status_code=503, detail="Model training is disabled: ML_TRAINING_TOKEN is not configured.")
    supplied_token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not hmac.compare_digest(supplied_token, ML_TRAINING_TOKEN):
        raise HTTPException(status_code=401, detail="Valid training credentials are required.")
    if not request.records:
        return {"status": "unavailable", "message": insufficient_message()}
    df = pd.DataFrame(request.records)
    result = train_and_evaluate(df, task=request.task, model_dir=MODEL_DIR, run_ablation=request.run_ablation)
    return result.__dict__


@app.get("/api/research/metrics")
def get_metrics():
    bundle = load_production_bundle(MODEL_DIR)
    if bundle is None:
        return {"metrics": [], "message": "No results available. Run the evaluation pipeline to generate results."}
    return {"metrics": bundle.get("metrics") or [], "message": None, "best_model": bundle.get("best_model")}


@app.get("/api/research/models")
def get_models():
    bundle = load_production_bundle(MODEL_DIR)
    return {
        "models": ["Linear Regression", "Random Forest", "XGBoost"],
        "classification": ["Logistic Regression", "Random Forest Classifier", "XGBoost Classifier"],
        "temporal_architecture_only": list(temporal_status().keys()),
        "production_loaded": bundle is not None,
        "mode": None if bundle is None else bundle.get("mode"),
        "best_model": None if bundle is None else bundle.get("best_model"),
    }


@app.get("/api/research/feature-importance")
def research_feature_importance():
    bundle = load_production_bundle(MODEL_DIR)
    if bundle is None:
        return {"feature_importance": {}, "ablation": {}, "message": "No evaluation results available yet."}
    return {
        "feature_importance": bundle.get("feature_importance") or {},
        "ablation": bundle.get("ablation") or {},
        "message": None,
    }


@app.post("/api/recommendations/evaluate")
def recommendations(payload: Dict[str, Any]):
    return {"data": recommend_from_features(payload.get("features") or {})}


@app.post("/api/insights/evaluate")
def insights_evaluate(payload: Dict[str, Any]):
    return {"data": build_insights(payload.get("lifestyle") or [])}


@app.post("/api/notifications/evaluate")
def notifications_evaluate(payload: Dict[str, Any]):
    enabled = bool(payload.get("notifications_enabled", True))
    return {"data": build_notifications(payload.get("lifestyle") or [], enabled)}


@app.get("/api/profile")
def get_profile(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    data = store.select("profiles", f"user_id=eq.{user_id}", maybe_single=True)
    return {"data": data}


@app.put("/api/profile")
def put_profile(body: ProfileIn, user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    row = {"user_id": user_id, **{k: v for k, v in body.model_dump().items() if v is not None}}
    data = store.upsert("profiles", row, "user_id")
    return {"data": data}


@app.post("/api/consent")
def post_consent(body: ConsentIn, user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    if not body.data_processing_consent:
        raise HTTPException(status_code=400, detail="Data processing consent is required.")
    data = store.upsert(
        "consent",
        {
            "user_id": user_id,
            "consent_version": "1.0",
            "research_consent": body.research_consent,
            "data_processing_consent": True,
            "consented_at": datetime.now(timezone.utc).isoformat(),
            "withdrawn_at": None,
        },
        "user_id",
    )
    return {"data": data}


@app.delete("/api/consent")
def delete_consent(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    data = store.update(
        "consent",
        f"user_id=eq.{user_id}",
        {
            "withdrawn_at": datetime.now(timezone.utc).isoformat(),
            "research_consent": False,
            "data_processing_consent": False,
        },
    )
    return {"data": data}


@app.post("/api/lifestyle")
def post_lifestyle(body: LifestyleIn, user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    row = {"user_id": user_id, **body.model_dump()}
    data = store.upsert("daily_lifestyle", row, "user_id,date")
    return {"data": data, "source": "real-user-data"}


@app.get("/api/lifestyle")
def get_lifestyle(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep), limit: int = 30):
    data = store.select(
        "daily_lifestyle",
        f"user_id=eq.{user_id}&order=date.desc&limit={min(limit, 365)}",
    )
    return {"data": data, "source": "real-user-data"}


@app.get("/api/lifestyle/trends")
def lifestyle_trends(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep), days: int = 30):
    data = store.select(
        "daily_lifestyle",
        f"user_id=eq.{user_id}&order=date.asc&limit={min(max(days, 1), 365)}",
    )
    return {"data": data, "source": "real-user-data"}


@app.post("/api/wellbeing/checkin")
def post_checkin(body: CheckinIn, user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    row = {"user_id": user_id, **body.model_dump()}
    data = store.upsert("wellbeing_checkins", row, "user_id,date")
    return {"data": data, "source": "real-user-data"}


@app.post("/api/mood")
def post_mood(body: MoodIn, user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    row = {"user_id": user_id, **body.model_dump()}
    data = store.upsert("wellbeing_checkins", row, "user_id,date")
    return {"data": data, "source": "real-user-data"}


@app.post("/api/sleep")
def post_sleep(body: SleepIn, user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    row = {"user_id": user_id, **body.model_dump()}
    data = store.upsert("sleep_records", row, "user_id,date")
    return {"data": data, "source": "real-user-data"}


@app.get("/api/sleep")
def get_sleep(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep), limit: int = 30):
    data = store.select("sleep_records", f"user_id=eq.{user_id}&order=date.desc&limit={min(limit, 365)}")
    return {"data": data, "source": "real-user-data"}


@app.post("/api/activity/sync")
def post_activity_sync(body: ActivitySyncIn, user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    settings = store.select("user_settings", f"user_id=eq.{user_id}", maybe_single=True) or {}
    if settings.get("data_collection_enabled") is False:
        raise HTTPException(status_code=403, detail="Data collection is paused in your privacy settings.")
    totals = body.totals or {}
    lifestyle = {
        "user_id": user_id,
        "date": body.date,
        "total_screen_time_minutes": int(totals.get("totalMinutes") or 0),
        "social_media_minutes": int(totals.get("socialMediaMinutes") or 0),
        "late_night_usage_minutes": int(totals.get("lateNightMinutes") or 0),
        "sleep_duration_minutes": 0,
        "physical_activity_minutes": 0,
        "study_work_minutes": int(totals.get("productivityMinutes") or 0),
        "source": "integration",
    }
    store.upsert("daily_lifestyle", lifestyle, "user_id,date")
    rows = []
    for domain in body.domains[:500]:
        rows.append(
            {
                "user_id": user_id,
                "date": body.date,
                "application_name": str(domain.get("domain") or "")[:255],
                "category": str(domain.get("category") or "other")[:100],
                "usage_minutes": int(domain.get("usageMinutes") or 0),
                "launch_count": int(domain.get("visitCount") or 0),
            }
        )
    if rows:
        store.insert("application_usage", rows)
    return {"synced": True, "date": body.date, "domains": len(rows), "source": "real-user-data"}


@app.get("/api/wellbeing")
def get_wellbeing(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep), limit: int = 30):
    data = store.select(
        "wellbeing_checkins",
        f"user_id=eq.{user_id}&order=date.desc&limit={min(limit, 365)}",
    )
    return {"data": data, "source": "real-user-data"}


@app.get("/api/wellbeing/trends")
def wellbeing_trends(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep), days: int = 30):
    data = store.select(
        "wellbeing_checkins",
        f"user_id=eq.{user_id}&order=date.asc&limit={min(max(days, 1), 365)}",
    )
    return {"data": data, "source": "real-user-data"}


def _run_user_analysis(user_id: str, store: UserStore) -> Dict[str, Any]:
    lifestyle = store.select("daily_lifestyle", f"user_id=eq.{user_id}&order=date.asc&limit=60") or []
    checkins = store.select("wellbeing_checkins", f"user_id=eq.{user_id}&order=date.asc&limit=60") or []
    settings = store.select("user_settings", f"user_id=eq.{user_id}", maybe_single=True) or {}
    latest_life = lifestyle[-1] if lifestyle else None
    latest_check = checkins[-1] if checkins else None
    features = merge_daily_features(latest_life, latest_check)
    insights = build_insights(lifestyle)
    recs = recommend_from_features(features)
    ml = predict_one(features, model_dir=MODEL_DIR) if features else {
        "status": "unavailable",
        "message": "No wellbeing data available yet. Complete your first check-in to begin your analysis.",
        "prediction": None,
    }
    explanation = explain_prediction(
        prediction=ml.get("prediction"),
        shap_values=ml.get("shap") or {},
        insights=insights,
    )
    notes = build_notifications(lifestyle, bool(settings.get("notifications_enabled", True)))
    today = (latest_life or latest_check or {}).get("date") or datetime.now(timezone.utc).date().isoformat()
    store.upsert(
        "daily_analysis",
        {
            "user_id": user_id,
            "date": today,
            "analysis_result": {
                "insights": insights,
                "recommendations": recs,
                "ml": {k: v for k, v in ml.items() if k != "llm_explanation"},
                "llm_explanation": explanation,
            },
            "summary": explanation.get("text"),
            "recommendations": recs,
            "contributing_factors": [item.get("message") for item in insights],
            "model_name": ml.get("model_name"),
            "overall_wellbeing_score": ml.get("prediction"),
        },
        "user_id,date",
    )
    for note in notes:
        store.insert(
            "notifications",
            [
                {
                    "user_id": user_id,
                    "type": "pattern",
                    "title": "Lifestyle pattern update",
                    "message": note["message"],
                    "severity": "info",
                    "read": False,
                }
            ],
        )
    return {
        "source": "real-user-data",
        "ml_source": "model-generated-results" if ml.get("status") == "ok" else "unavailable",
        "insights": insights,
        "recommendations": recs,
        "ml": ml,
        "llm_explanation": explanation,
        "notifications": notes,
    }


@app.get("/api/analysis/daily")
def analysis_daily(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    today = datetime.now(timezone.utc).date().isoformat()
    data = store.select("daily_analysis", f"user_id=eq.{user_id}&date=eq.{today}", maybe_single=True)
    if not data:
        return {
            "data": None,
            "message": "No wellbeing data available yet. Complete your first check-in to begin your analysis.",
        }
    return {"data": data, "source": "model-generated-results"}


@app.get("/api/analysis/trends")
def analysis_trends(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    data = store.select("daily_analysis", f"user_id=eq.{user_id}&order=date.desc&limit=30")
    return {"data": data or []}


@app.post("/api/analysis/run")
def analysis_run(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    return _run_user_analysis(user_id, store)


@app.get("/api/insights")
def get_insights(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    lifestyle = store.select("daily_lifestyle", f"user_id=eq.{user_id}&order=date.asc&limit=30") or []
    return {"data": build_insights(lifestyle), "source": "real-user-data"}


@app.get("/api/recommendations")
def get_recs(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    lifestyle = store.select("daily_lifestyle", f"user_id=eq.{user_id}&order=date.desc&limit=1") or []
    features = lifestyle[0] if lifestyle else {}
    return {"data": recommend_from_features(features)}


@app.get("/api/notifications")
def get_notifications(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    data = store.select("notifications", f"user_id=eq.{user_id}&order=created_at.desc&limit=50")
    return {"data": data or []}


@app.put("/api/notifications/preferences")
def put_notification_prefs(body: SettingsIn, user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    if body.notifications_enabled is None:
        raise HTTPException(status_code=400, detail="notifications_enabled is required.")
    data = store.upsert(
        "user_settings",
        {"user_id": user_id, "notifications_enabled": body.notifications_enabled},
        "user_id",
    )
    return {"data": data}


@app.put("/api/settings")
def put_settings(body: SettingsIn, user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    patch = {"user_id": user_id, **{k: v for k, v in body.model_dump().items() if v is not None}}
    data = store.upsert("user_settings", patch, "user_id")
    return {"data": data}


@app.post("/api/chat")
def post_chat(body: ChatIn, user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    settings = store.select("user_settings", f"user_id=eq.{user_id}", maybe_single=True) or {}
    if settings.get("chatbot_enabled") is False:
        raise HTTPException(status_code=403, detail="Assistant is disabled in settings.")
    lifestyle = store.select("daily_lifestyle", f"user_id=eq.{user_id}&order=date.desc&limit=7") or []
    checkins = store.select("wellbeing_checkins", f"user_id=eq.{user_id}&order=date.desc&limit=7") or []
    summary = f"Recent lifestyle days: {len(lifestyle)}. Recent check-ins: {len(checkins)}."
    reply = chat_reply(body.message, summary)
    return {"reply": reply, "clinical": False}


@app.get("/api/export")
def export_data(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    tables = [
        "profiles",
        "user_settings",
        "consent",
        "daily_lifestyle",
        "wellbeing_checkins",
        "sleep_records",
        "daily_analysis",
        "recommendations",
        "notifications",
        "application_usage",
    ]
    payload = {}
    for table in tables:
        try:
            payload[table] = store.select(table, f"user_id=eq.{user_id}&limit=1000") or []
        except HTTPException:
            payload[table] = []
    return {"exportedAt": datetime.now(timezone.utc).isoformat(), "data": payload}


@app.delete("/api/privacy/data")
def delete_personal_data(user_id: str = Depends(get_user_id), store: UserStore = Depends(store_dep)):
    for table in [
        "daily_lifestyle",
        "wellbeing_checkins",
        "sleep_records",
        "daily_analysis",
        "recommendations",
        "notifications",
        "application_usage",
    ]:
        try:
            store.delete(table, f"user_id=eq.{user_id}")
        except HTTPException:
            continue
    return {"deleted": True}


@app.get("/api/research/overview")
def research_overview():
    bundle = load_production_bundle(MODEL_DIR)
    return {
        "message": "Participant counts are served from the application database, not fabricated here.",
        "model_loaded": bundle is not None,
        "completeness_note": "Use GET /api/research/metrics after a real evaluation run.",
        "data_completeness_example": completeness([], ["wellbeing_score"]),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
