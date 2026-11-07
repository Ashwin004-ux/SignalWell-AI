"""
ML prediction endpoints. These are additive to the app — the Next.js
dashboard's existing /dashboard/insights page shows ai_analysis (the LLM
layer); a future "Estimated wellbeing score" widget would call
GET /ml/predictions/me and display predicted_value_numeric alongside (not
instead of) that LLM-written summary, with a label making clear it's a
statistical estimate, not the LLM's interpretation and not a diagnosis.
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user, get_user_supabase_client
from app.core.security import AuthenticatedUser
from app.ml.data.features import FEATURE_COLUMNS, build_features
from app.ml.data.validation import validate
from app.schemas.ml import PredictionListResponse, PredictionResponse
from app.services.ml_prediction_service import generate_and_save_prediction

router = APIRouter(prefix="/ml", tags=["ml"])


@router.get("/predictions/me", response_model=PredictionListResponse)
def list_my_predictions(
    task: str = "regression",
    user: AuthenticatedUser = Depends(get_current_user),
    supabase=Depends(get_user_supabase_client),
):
    resp = (
        supabase.table("ml_predictions")
        .select("*, ml_models(model_name, model_version)")
        .eq("user_id", user.user_id)
        .eq("task", task)
        .order("date", desc=True)
        .limit(30)
        .execute()
    )
    predictions = [
        PredictionResponse(
            date=str(row["date"]),
            model_name=row["ml_models"]["model_name"],
            model_version=row["ml_models"]["model_version"],
            task=row["task"],
            predicted_value_numeric=row.get("predicted_value_numeric"),
            predicted_value_label=row.get("predicted_value_label"),
            confidence=row.get("confidence"),
            top_contributing_features=row.get("top_contributing_features") or [],
            feature_contributions=row.get("feature_contributions") or {},
        )
        for row in (resp.data or [])
    ]
    return PredictionListResponse(predictions=predictions)


@router.post("/predictions/me/generate", response_model=PredictionResponse)
def generate_my_prediction(
    task: str = "regression",
    user: AuthenticatedUser = Depends(get_current_user),
    supabase=Depends(get_user_supabase_client),
):
    """
    Builds today's feature row for the current user from their own recent
    data (RLS-scoped — this query can only ever return this user's rows)
    and generates a prediction with the current best saved model for
    `task`. Returns 422 with the exact "Model evaluation requires
    sufficient research data." wording if there isn't enough history to
    compute the rolling features, and 404 if no model has been trained and
    saved for this task yet — never a fabricated prediction in either case.
    """
    resp = (
        supabase.table("daily_activity")
        .select("*, sleep_records(sleep_duration_minutes), mood_records(mood_score, stress_score, anxiety_score, wellbeing_score, energy_score)")
        .eq("user_id", user.user_id)
        .order("date", desc=True)
        .limit(21)  # enough trailing days for the 7-day rolling features plus the target day
        .execute()
    )
    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=422, detail="Model evaluation requires sufficient research data.")

    flat_rows = []
    for r in rows:
        sleep = (r.get("sleep_records") or [{}])
        sleep = sleep[0] if isinstance(sleep, list) and sleep else (sleep or {})
        mood = (r.get("mood_records") or [{}])
        mood = mood[0] if isinstance(mood, list) and mood else (mood or {})
        flat_rows.append({**r, **sleep, **mood})

    df = pd.DataFrame(flat_rows)
    clean, _report = validate(df)
    feats = build_features(clean)
    if feats.empty or str(feats.iloc[-1]["date"]) != str(rows[0]["date"]):
        raise HTTPException(status_code=422, detail="Model evaluation requires sufficient research data.")

    target_row = feats.iloc[-1]
    background = feats[FEATURE_COLUMNS]

    saved = generate_and_save_prediction(user.user_id, task, target_row, background)
    if saved is None:
        raise HTTPException(status_code=404, detail="No trained model is available for this task yet.")

    return PredictionResponse(
        date=str(saved["date"]),
        model_name="",  # not re-fetched here; list_my_predictions includes it via the join
        model_version="",
        task=saved["task"],
        predicted_value_numeric=saved.get("predicted_value_numeric"),
        predicted_value_label=saved.get("predicted_value_label"),
        confidence=saved.get("confidence"),
        top_contributing_features=saved.get("top_contributing_features") or [],
        feature_contributions=saved.get("feature_contributions") or {},
    )
