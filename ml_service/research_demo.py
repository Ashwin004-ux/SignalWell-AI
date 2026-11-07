"""Read-only synthetic research demo API; it never touches the user database."""

import json
import math
from functools import lru_cache
from pathlib import Path
from statistics import mean
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from insights import build_notifications
from recommendations import recommend_from_features

router = APIRouter(prefix="/api/research-demo", tags=["research-demo"])
DATASET_PATH = Path(__file__).resolve().parent / "data" / "research_demo_v1.json"
WINDOWS = (7, 30)
MIN_VALID_BASELINE_OBSERVATIONS = 5
BASELINE_FIELDS = {
    "screen_time": ("total_screen_time_minutes", "minutes/day"),
    "social_media": ("social_media_minutes", "minutes/day"),
    "late_night": ("late_night_usage_minutes", "minutes/day"),
    "sleep": ("sleep_duration_minutes", "minutes/day"),
    "movement": ("physical_activity_minutes", "minutes/day"),
    "mood": ("mood_score", "score / 10"),
    "stress": ("stress_score", "score / 10"),
    "anxiety": ("anxiety_score", "score / 10"),
    "wellbeing": ("wellbeing_score", "score / 10"),
}


class DemoMetadata(BaseModel):
    dataset_name: str
    version: str
    source: Literal["synthetic_demo"]
    profile_count: int
    days_per_profile: int
    supported_windows: list[int]
    target_note: str


class DemoUser(BaseModel):
    id: str
    label: str


class DemoObservation(BaseModel):
    user_id: str
    date: str
    day_index: int
    weekday: str
    total_screen_time_minutes: int
    social_media_minutes: int
    late_night_usage_minutes: int
    notifications_count: int
    app_switches: int
    sleep_duration_minutes: int
    sleep_duration_hours: float
    physical_activity_minutes: int
    study_work_minutes: int
    mood_score: int
    stress_score: int
    anxiety_score: int
    energy_score: int
    wellbeing_score: int
    target_kind: Literal["synthetic_reference"]
    source: Literal["synthetic_demo"]


class DemoObservationsResponse(BaseModel):
    source: Literal["synthetic_demo"]
    dataset_version: str
    user_id: str
    days: Literal[7, 30]
    start_date: str
    end_date: str
    available_observations: int
    coverage_status: Literal["complete", "partial", "empty"]
    observations: list[DemoObservation]


class Period(BaseModel):
    start: str
    end: str
    observations: int


class BaselineMetric(BaseModel):
    field: str
    unit: str
    baseline: Optional[float]
    recent: Optional[float]
    difference: Optional[float]
    percent_change: Optional[float]


class BaselineResponse(BaseModel):
    source: Literal["synthetic_demo"]
    user_id: str
    days: Literal[7, 30]
    start_date: str
    end_date: str
    available_observations: int
    coverage_status: Literal["complete", "partial", "empty"]
    baseline_period: Optional[Period]
    comparison_period: Optional[Period]
    convention: str
    metrics: dict[str, BaselineMetric]


class Deviation(BaseModel):
    baseline: float
    difference: float
    percent_change: Optional[float]


class AnalyzedObservation(DemoObservation):
    baseline_values: dict[str, Optional[float]] = Field(default_factory=dict)
    deviations: dict[str, Optional[Deviation]]
    rule_score: Optional[int]
    risk_level: str
    risk_reasons: list[str]


class DemoAlert(BaseModel):
    date: str
    method: str
    message: str
    reasons: Optional[list[str]] = None
    status: Literal["simulated"]


class Recommendation(BaseModel):
    category: str
    suggestion: str


class AnalysisResponse(BaseModel):
    source: Literal["synthetic_demo"]
    user_id: str
    days: Literal[7, 30]
    start_date: str
    end_date: str
    available_observations: int
    coverage_status: Literal["complete", "partial", "empty"]
    observations: list[AnalyzedObservation]
    baseline: BaselineResponse
    alerts: list[DemoAlert]
    recommendations: list[Recommendation]
    latest_risk: str
    baseline_ready: bool
    alert_note: str


class EvaluationInfo(BaseModel):
    method: str
    target: str
    held_out_records: int
    metrics: list[dict[str, Any]]


class ModelInfo(BaseModel):
    id: str
    name: str
    task: Optional[str] = None
    artifact_version: str
    mode: str
    supported_for_demo: bool
    feature_columns: list[str]


class ModelsResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    available: bool
    model_status: Literal["not_trained", "training_failed", "artifact_missing", "artifact_invalid", "inference_unavailable", "ready"]
    models: list[ModelInfo]
    message: Optional[str] = None
    evaluation: Optional[EvaluationInfo] = None
    evaluation_status: Optional[str] = None
    explainability_status: Optional[str] = None


class EvaluationResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    available: bool
    model_status: Literal["not_trained", "training_failed", "artifact_missing", "artifact_invalid", "inference_unavailable", "ready"]
    metrics: list[dict[str, Any]] = Field(default_factory=list)
    method: Optional[str] = None
    target: Optional[str] = None
    held_out_records: Optional[int] = None
    message: Optional[str] = None


class PredictionRow(BaseModel):
    date: str
    prediction: float
    synthetic_reference: float
    absolute_error: float


class PredictionResponse(BaseModel):
    source: Literal["synthetic_demo"]
    prediction_source: Literal["real_model_inference"]
    model: ModelInfo
    input_features: list[str]
    target_note: str
    evaluation: Optional[EvaluationInfo]
    predictions: list[PredictionRow]
    explainability: dict[str, Any]


class AlertsResponse(BaseModel):
    source: Literal["synthetic_demo"]
    user_id: str
    days: Literal[7, 30]
    start_date: str
    end_date: str
    available_observations: int
    coverage_status: Literal["complete", "partial", "empty"]
    alerts: list[DemoAlert]
    note: str


class PredictionRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    user_id: str = Field(pattern=r"^demo-[a-z0-9-]{1,40}$")
    days: Literal[7, 30]
    model_name: Literal["production"] = "production"


@lru_cache(maxsize=1)
def load_dataset() -> dict[str, Any]:
    try:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("The versioned synthetic research dataset could not be loaded.") from exc
    if dataset.get("source") != "synthetic_demo" or not isinstance(dataset.get("profiles"), list):
        raise RuntimeError("The synthetic research dataset metadata is invalid.")
    required = set(DemoObservation.model_fields)
    for profile in dataset["profiles"]:
        rows = profile.get("observations", [])
        if len(rows) != 30 or any(required - row.keys() for row in rows):
            raise RuntimeError("The synthetic research dataset failed its schema validation.")
        if [row["date"] for row in rows] != sorted(row["date"] for row in rows):
            raise RuntimeError("The synthetic research observations are not chronologically ordered.")
    return dataset


def list_profiles() -> list[dict[str, str]]:
    return [{"id": row["id"], "label": row["label"]} for row in load_dataset()["profiles"]]


def get_profile(user_id: str) -> dict[str, Any]:
    for profile in load_dataset()["profiles"]:
        if profile["id"] == user_id:
            return profile
    raise HTTPException(status_code=404, detail="Synthetic demo profile not found.")


def validate_window(days: int) -> Literal[7, 30]:
    if days not in WINDOWS:
        raise HTTPException(status_code=422, detail="The demo supports only 7-day and 30-day windows.")
    return days  # type: ignore[return-value]


def select_observations(user_id: str, days: int) -> list[dict[str, Any]]:
    validate_window(days)
    rows = get_profile(user_id)["observations"]
    if not rows:
        return []
    from datetime import date, timedelta

    end = date.fromisoformat(rows[-1]["date"])
    start = end - timedelta(days=days - 1)
    return [row for row in rows if start <= date.fromisoformat(row["date"]) <= end]


def window_metadata(user_id: str, days: int, rows: list[dict[str, Any]]) -> dict[str, Any]:
    from datetime import date, timedelta

    profile_rows = get_profile(user_id)["observations"]
    end = date.fromisoformat(profile_rows[-1]["date"]) if profile_rows else date.today()
    start = end - timedelta(days=days - 1)
    count = len(rows)
    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "available_observations": count,
        "coverage_status": "empty" if count == 0 else "complete" if count == days else "partial",
    }


def _average(rows: list[dict[str, Any]], field: str) -> Optional[float]:
    values = [float(row[field]) for row in rows if isinstance(row.get(field), (int, float))]
    return round(mean(values), 2) if values else None


def _baseline_average(rows: list[dict[str, Any]], field: str) -> Optional[float]:
    values = [float(row[field]) for row in rows if isinstance(row.get(field), (int, float))]
    if len(values) < MIN_VALID_BASELINE_OBSERVATIONS:
        return None
    return round(mean(values), 2)


def calculate_baseline(user_id: str, days: int) -> dict[str, Any]:
    selected = select_observations(user_id, days)
    profile_rows = get_profile(user_id)["observations"]
    if days == 7:
        from datetime import date

        start_date = window_metadata(user_id, days, selected)["start_date"]
        reference = [row for row in profile_rows if date.fromisoformat(row["date"]) < date.fromisoformat(start_date)][-7:]
        convention = "Up to the 7 observations immediately before the selected 7-day calendar window; at least 5 valid values are required per metric."
        comparison = selected
    else:
        reference = selected[:7] if len(selected) >= 14 else []
        convention = "The first 7 observations compared with the latest 7 in the 30-day window when at least 14 rows exist; daily deviations use only preceding observations."
        comparison = selected[-7:]

    metrics = {}
    for name, (field, unit) in BASELINE_FIELDS.items():
        base = _baseline_average(reference, field)
        recent = _baseline_average(comparison, field)
        delta = round(recent - base, 2) if base is not None and recent is not None else None
        percent = round(delta / abs(base) * 100, 1) if delta is not None and base not in (None, 0) else None
        metrics[name] = {"field": field, "unit": unit, "baseline": base, "recent": recent, "difference": delta, "percent_change": percent}
    return {
        "source": "synthetic_demo",
        "user_id": user_id,
        "days": days,
        **window_metadata(user_id, days, selected),
        "baseline_period": {"start": reference[0]["date"], "end": reference[-1]["date"], "observations": len(reference)} if reference else None,
        "comparison_period": {"start": comparison[0]["date"], "end": comparison[-1]["date"], "observations": len(comparison)} if comparison else None,
        "convention": convention,
        "metrics": metrics,
    }


def _risk_for_prefix(rows: list[dict[str, Any]]) -> tuple[Optional[int], str, list[str]]:
    recent = rows[-7:]
    if len(recent) < 3:
        return None, "insufficient_observations", []
    score = 0
    reasons = []
    screen = _average(recent, "total_screen_time_minutes")
    late = _average(recent, "late_night_usage_minutes")
    sleep = _average(recent, "sleep_duration_minutes")
    mood = _average(recent, "mood_score")
    stress = _average(recent, "stress_score")
    anxiety = _average(recent, "anxiety_score")
    if screen is not None and screen > 360:
        score += 1
        reasons.append("Average logged browser activity was above the rule's reference level.")
    if late is not None and late > 30:
        score += 1
        reasons.append("Average late-night activity was above the rule's reference level.")
    if sleep is not None and sleep < 420:
        score += 1
        reasons.append("Average self-reported sleep was below the rule's reference level.")
    if mood is not None and mood <= 5:
        score += 1
        reasons.append("Average self-reported mood was at or below 5/10.")
    if stress is not None and stress >= 6:
        score += 1
        reasons.append("Average self-reported stress was at or above 6/10.")
    if anxiety is not None and anxiety >= 6:
        score += 1
        reasons.append("Average self-reported anxiety was at or above 6/10.")
    level = "elevated" if score >= 4 else "monitor" if score >= 2 else "stable"
    return score, level, reasons


def build_analysis(user_id: str, days: int) -> dict[str, Any]:
    selected = select_observations(user_id, days)
    history = get_profile(user_id)["observations"]
    selected_dates = {row["date"] for row in selected}
    series = []
    alerts = []
    for index, row in enumerate(history):
        if row["date"] not in selected_dates:
            continue
        prior = history[max(0, index - 7):index]
        baseline_values = {name: _baseline_average(prior, field) for name, (field, _) in BASELINE_FIELDS.items()} if len(prior) >= 7 else {}
        deviations = {}
        for name, (field, _) in BASELINE_FIELDS.items():
            baseline = baseline_values.get(name)
            value = row.get(field)
            if baseline is not None and isinstance(value, (int, float)):
                delta = round(float(value) - baseline, 2)
                deviations[name] = {"baseline": baseline, "difference": delta, "percent_change": round(delta / abs(baseline) * 100, 1) if baseline else None}
            else:
                deviations[name] = None

        through_date = history[:index + 1]
        fixed_alerts = _risk_for_prefix(through_date)
        personalized = build_notifications(through_date, True)
        score, risk_level, reasons = fixed_alerts
        series.append({
            **row,
            "baseline_values": baseline_values,
            "deviations": deviations,
            "rule_score": score,
            "risk_level": risk_level,
            "risk_reasons": reasons,
        })
        for item in personalized:
            alerts.append({"date": row["date"], "method": "personalized_baseline", "message": item["message"], "status": "simulated"})
        if score is not None and score >= 2:
            alerts.append({"date": row["date"], "method": "fixed_rule_comparison", "message": f"{len(reasons)} rule indicators were present in the trailing observations.", "reasons": reasons, "status": "simulated"})

    baseline = calculate_baseline(user_id, days)
    observations_with_baseline = [item for item in series if item["baseline_values"]]
    return {
        "source": "synthetic_demo",
        "user_id": user_id,
        "days": days,
        **window_metadata(user_id, days, selected),
        "observations": series,
        "baseline": baseline,
        "alerts": alerts,
        "recommendations": recommend_from_features(selected[-1]) if selected else [],
        "latest_risk": series[-1]["risk_level"] if series else "insufficient_observations",
        "baseline_ready": any(any(value is not None for value in item["baseline_values"].values()) for item in observations_with_baseline),
        "alert_note": "Alerts are simulated from existing rule patterns and are not diagnoses or real incidents.",
    }


def available_model() -> dict[str, Any]:
    from pipeline import load_production_bundle

    from main import MODEL_DIR

    bundle = load_production_bundle(MODEL_DIR)
    if not bundle:
        from main import MODEL_DIR

        artifact = Path(MODEL_DIR) / "production.joblib"
        status = "artifact_invalid" if artifact.exists() else "artifact_missing"
        return {"available": False, "model_status": status, "models": [], "message": "No validated production model artifact is available. Train and validate a model on authorized, appropriately labeled data before running inference."}
    evaluation = bundle.get("evaluation")
    return {
        "available": True,
        "model_status": "ready",
        "models": [{"id": "production", "name": bundle.get("best_model") or "Production model", "task": bundle.get("task"), "artifact_version": bundle.get("artifact_version", "unversioned"), "mode": bundle.get("mode", "unknown"), "supported_for_demo": bundle.get("task") == "regression", "feature_columns": bundle.get("feature_columns") or []}],
        "message": None,
        "evaluation": evaluation if isinstance(evaluation, dict) and evaluation.get("held_out_records", 0) > 0 else None,
        "evaluation_status": "recorded_holdout" if isinstance(evaluation, dict) and evaluation.get("held_out_records", 0) > 0 else "unverified_or_unavailable",
        "explainability_status": "validation_pending",
    }


@router.get("/metadata", response_model=DemoMetadata)
def metadata():
    data = load_dataset()
    return {
        "dataset_name": data["dataset_name"], "version": data["version"], "source": data["source"],
        "profile_count": len(data["profiles"]), "days_per_profile": 30, "supported_windows": list(WINDOWS),
        "target_note": "Wellbeing scores are generated synthetic reference values, not participant reports or clinical ground truth.",
    }


@router.get("/users", response_model=list[DemoUser])
def users():
    return list_profiles()


@router.get("/users/{user_id}/observations", response_model=DemoObservationsResponse)
def observations(user_id: str, days: int = Query(default=7)):
    selected = select_observations(user_id, days)
    return {"source": "synthetic_demo", "dataset_version": load_dataset()["version"], "user_id": user_id, "days": days, **window_metadata(user_id, days, selected), "observations": selected}


@router.get("/users/{user_id}/baseline", response_model=BaselineResponse)
def baseline(user_id: str, days: int = Query(default=7)):
    return calculate_baseline(user_id, days)


@router.get("/users/{user_id}/analysis", response_model=AnalysisResponse)
def analysis(user_id: str, days: int = Query(default=7)):
    return build_analysis(user_id, days)


@router.get("/models", response_model=ModelsResponse)
def models():
    return available_model()


@router.get("/evaluation", response_model=EvaluationResponse)
def evaluation():
    model_status = available_model()
    if model_status.get("evaluation") is None:
        return {"available": False, "model_status": model_status["model_status"], "metrics": [], "message": "No reproducible held-out evaluation metadata is available. Synthetic demo predictions are not used to calculate model-performance metrics."}
    return {"available": True, "model_status": model_status["model_status"], **model_status["evaluation"]}


@router.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    selected = select_observations(request.user_id, request.days)
    model_status = available_model()
    if not model_status["available"]:
        raise HTTPException(status_code=503, detail=model_status["message"])
    from main import MODEL_DIR
    from pipeline import load_production_bundle, predict_one

    bundle = load_production_bundle(MODEL_DIR)
    if not bundle or not callable(getattr(bundle.get("pipeline"), "predict", None)):
        raise HTTPException(status_code=503, detail="The configured production model artifact is invalid or unavailable.")
    if bundle.get("task") != "regression":
        raise HTTPException(status_code=409, detail="The configured production model is a classifier. This demo's wellbeing target requires a regression model.")
    predictions = []
    for row in selected:
        result = predict_one(row, model_dir=MODEL_DIR)
        if result.get("status") != "ok" or not isinstance(result.get("prediction"), (int, float)):
            raise HTTPException(status_code=503, detail="The production model could not analyze this observation.")
        prediction = float(result["prediction"])
        if not math.isfinite(prediction):
            raise HTTPException(status_code=503, detail="The production model returned a non-finite prediction.")
        reference = float(row["wellbeing_score"])
        predictions.append({"date": row["date"], "prediction": prediction, "synthetic_reference": reference, "absolute_error": round(abs(prediction - reference), 3)})
    return {
        "source": "synthetic_demo",
        "prediction_source": "real_model_inference",
        "model": model_status["models"][0],
        "input_features": bundle.get("feature_columns") or [],
        "target_note": "Synthetic reference values are not clinical ground truth. Per-row errors are illustrative and do not replace held-out model evaluation.",
        "evaluation": model_status.get("evaluation"),
        "predictions": predictions,
        "explainability": {"available": False, "message": "Feature explanations are hidden until the existing SHAP output passes stability validation."},
    }


@router.get("/alerts", response_model=AlertsResponse)
def alerts(user_id: str, days: int = Query(default=7)):
    result = build_analysis(user_id, days)
    return {"source": "synthetic_demo", "user_id": user_id, "days": days, **window_metadata(user_id, days, select_observations(user_id, days)), "alerts": result["alerts"], "note": result["alert_note"]}

class DemoAssistantRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    user_id: str = Field(pattern=r"^demo-[a-z0-9-]{1,40}$")
    days: Literal[7, 30]
    question: str = Field(min_length=1, max_length=2000)


class DemoAssistantResponse(BaseModel):
    source: Literal["synthetic_demo"]
    assistant_mode: Literal["llm", "computed_fallback", "unavailable"]
    user_id: str
    days: Literal[7, 30]
    start_date: str
    end_date: str
    available_observations: int
    reply: str
    provider_note: str


def _demo_assistant_context(user_id: str, days: int) -> dict[str, Any]:
    selected = select_observations(user_id, days)
    analysis_result = build_analysis(user_id, days)
    model_state = available_model()
    prediction_rows: list[dict[str, Any]] = []
    if model_state["available"] and model_state["models"] and model_state["models"][0]["supported_for_demo"]:
        try:
            from main import MODEL_DIR
            from pipeline import predict_one
            for row in selected:
                result = predict_one(row, model_dir=MODEL_DIR)
                if result.get("status") == "ok" and isinstance(result.get("prediction"), (int, float)) and math.isfinite(float(result["prediction"])):
                    prediction_rows.append({"date": row["date"], "prediction": round(float(result["prediction"]), 3)})
        except Exception:
            prediction_rows = []

    numeric_fields = [field for field in BASELINE_FIELDS.values()]
    missing_fields = []
    for field, _unit in numeric_fields:
        field_missing = sum(1 for row in selected if row.get(field) is None)
        if field_missing:
            missing_fields.append({"field": field, "missing_observations": field_missing})

    return {
        "data_source": "synthetic_demo",
        "profile_id": user_id,
        "window_days": days,
        "start_date": analysis_result["start_date"],
        "end_date": analysis_result["end_date"],
        "available_observations": analysis_result["available_observations"],
        "coverage_status": analysis_result["coverage_status"],
        "observations": selected,
        "baseline": analysis_result["baseline"],
        "alerts": analysis_result["alerts"],
        "alert_rule_thresholds": {
            "average_screen_time_minutes_gt": 360,
            "average_late_night_minutes_gt": 30,
            "average_sleep_minutes_lt": 420,
            "average_mood_score_lte": 5,
            "average_stress_score_gte": 6,
            "average_anxiety_score_gte": 6,
            "minimum_trailing_observations": 3,
        },
        "model": {
            "status": model_state["model_status"],
            "available": model_state["available"],
            "evaluation": model_state.get("evaluation"),
            "predictions": prediction_rows,
            "prediction_note": None if prediction_rows else "No compatible model predictions are available for this window.",
        },
        "missing_fields": missing_fields,
        "scope_note": "Only the selected synthetic profile and requested date window are included. Browser observations are not operating-system-wide screen time.",
    }


def _format_demo_metric(baseline: dict[str, Any], name: str) -> str:
    metric = baseline["metrics"].get(name, {})
    previous = metric.get("baseline")
    recent = metric.get("recent")
    difference = metric.get("difference")
    unit = metric.get("unit", "")
    if previous is None or recent is None:
        return name.replace("_", " ") + " baseline comparison is unavailable because there are fewer than five valid values in a comparison period."
    direction = "increased" if (difference or 0) > 0 else "decreased" if (difference or 0) < 0 else "did not change"
    return f"{name.replace('_', ' ').capitalize()} {direction} from {previous:g} to {recent:g} {unit} across the documented comparison periods."


def _demo_computed_fallback(question: str, context: dict[str, Any]) -> Optional[str]:
    query = question.casefold()
    rows = context["observations"]
    if not rows:
        return "No observations are available in the selected synthetic window, so I cannot calculate an answer."
    if "screen" in query and "sleep" in query:
        return _format_demo_metric(context["baseline"], "screen_time") + " " + _format_demo_metric(context["baseline"], "sleep")
    if "stress" in query and any(word in query for word in ("highest", "most", "which", "day", "days")):
        maximum = max(row["stress_score"] for row in rows)
        dates = ", ".join(row["date"] for row in rows if row["stress_score"] == maximum)
        return f"The highest recorded synthetic stress score in this window was {maximum}/10 on {dates}."
    if "baseline" in query:
        return "Baseline convention: " + context["baseline"]["convention"] + " " + " ".join(_format_demo_metric(context["baseline"], name) for name in ("screen_time", "sleep", "stress"))
    if "alert" in query or "rule" in query:
        alerts = context["alerts"]
        if not alerts:
            return "No configured simulated alert fired in this selected window. The rule comparison checks trailing observations against the stated screen, late-night use, sleep, mood, stress, and anxiety thresholds."
        details = "; ".join(f"{item['date']}: {item['method'].replace('_', ' ')} — {item['message']}" + ((" Reasons: " + ", ".join(item["reasons"])) if item.get("reasons") else "") for item in alerts)
        return f"{len(alerts)} simulated alerts were recorded in this window. " + details
    if any(word in query for word in ("model", "prediction", "evaluation", "metric")):
        model = context["model"]
        if not model["available"]:
            return f"No compatible trained model is available (status: {model['status']}); predictions and evaluation metrics are unavailable."
        evaluation = model.get("evaluation")
        if evaluation:
            return f"Model status is {model['status']}. The held-out evaluation used {evaluation.get('held_out_records')} records with target {evaluation.get('target')}. Dataset source: {evaluation.get('dataset_source', 'unspecified')}. Metrics were computed for this recorded evaluation; they are not evidence of real-world accuracy."
        return f"Model status is {model['status']}, but no documented held-out evaluation is available."
    if "missing" in query or "unavailable" in query:
        missing = context["missing_fields"]
        if missing:
            details = ", ".join(f"{item['field']} ({item['missing_observations']} missing)" for item in missing)
            return "Missing values in this selected fixture window: " + details + "."
        return "No missing values were found among the fields checked in the selected synthetic fixture window. The fixture only represents browser activity and its listed self-reports; it does not include operating-system-wide usage."
    if "pattern" in query or "change" in query or "trend" in query or "30 day" in query or "30-day" in query:
        averages = {name: _average(rows, field) for name, (field, _unit) in BASELINE_FIELDS.items()}
        return (f"In the selected {context['window_days']}-day synthetic window ({context['start_date']} to {context['end_date']}, {context['available_observations']} observations), "
                f"descriptive averages were screen time {averages['screen_time']} min/day, sleep {round(averages['sleep'] / 60, 2) if averages['sleep'] is not None else 'unavailable'} h/day, "
                f"stress {averages['stress']}/10, and mood {averages['mood']}/10. These are descriptive summaries of synthetic observations, not causal or clinical findings.")
    return None


@router.post("/assistant", response_model=DemoAssistantResponse)
def demo_assistant(request: DemoAssistantRequest):
    validate_window(request.days)
    context = _demo_assistant_context(request.user_id, request.days)
    from llm import chat_provider_available, demo_chat_reply

    provider_note = "LLM answer generated from the selected synthetic profile and date window. It is not clinical advice."
    if chat_provider_available():
        try:
            reply = demo_chat_reply(request.question, json.dumps(context, ensure_ascii=False, allow_nan=False))
            if reply.strip():
                return {
                    "source": "synthetic_demo",
                    "assistant_mode": "llm",
                    "user_id": request.user_id,
                    "days": request.days,
                    **window_metadata(request.user_id, request.days, context["observations"]),
                    "reply": reply,
                    "provider_note": provider_note,
                }
        except Exception:
            provider_note = "The configured LLM could not respond; a limited computed fallback was attempted."
    else:
        provider_note = "LLM provider unavailable or unconfigured. This response, when supported, is a deterministic calculation from the selected synthetic observations, not an LLM answer."

    fallback = _demo_computed_fallback(request.question, context)
    if fallback is None:
        return {
            "source": "synthetic_demo",
            "assistant_mode": "unavailable",
            "user_id": request.user_id,
            "days": request.days,
            **window_metadata(request.user_id, request.days, context["observations"]),
            "reply": "I cannot answer that question with a verified deterministic calculation, and the LLM provider is unavailable.",
            "provider_note": provider_note,
        }
    return {
        "source": "synthetic_demo",
        "assistant_mode": "computed_fallback",
        "user_id": request.user_id,
        "days": request.days,
        **window_metadata(request.user_id, request.days, context["observations"]),
        "reply": fallback,
        "provider_note": provider_note,
    }