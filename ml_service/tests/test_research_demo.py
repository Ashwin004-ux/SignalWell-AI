import sys
import tempfile
from pathlib import Path

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from research_demo import (  # noqa: E402
    AnalysisResponse,
    BaselineResponse,
    DemoObservationsResponse,
    ModelsResponse,
    calculate_baseline,
    build_analysis,
    load_dataset,
    metadata,
    observations,
    PredictionRequest,
    users,
    select_observations,
    validate_window,
)


def test_dataset_has_fixed_profiles_and_complete_ordered_days():
    dataset = load_dataset()
    assert dataset["source"] == "synthetic_demo"
    assert dataset["profile_count"] == 3
    assert all(len(profile["observations"]) == 30 for profile in dataset["profiles"])
    for profile in dataset["profiles"]:
        rows = profile["observations"]
        assert [row["date"] for row in rows] == sorted(row["date"] for row in rows)
        assert all(row["source"] == "synthetic_demo" for row in rows)
        assert all(row["target_kind"] == "synthetic_reference" for row in rows)
        assert all(1 <= row["wellbeing_score"] <= 10 for row in rows)


def test_windows_return_seven_or_thirty_sequential_rows():
    assert len(select_observations("demo-steady", 7)) == 7
    rows = select_observations("demo-steady", 30)
    assert len(rows) == 30
    assert [row["day_index"] for row in rows] == list(range(1, 31))


def test_window_metadata_reports_calendar_boundaries_and_partial_coverage(monkeypatch):
    import research_demo

    profile = next(row for row in load_dataset()["profiles"] if row["id"] == "demo-steady")
    sparse = {**profile, "observations": [row for index, row in enumerate(profile["observations"]) if index != 25]}
    monkeypatch.setattr(research_demo, "get_profile", lambda user_id: sparse if user_id == sparse["id"] else (_ for _ in ()).throw(HTTPException(status_code=404)))

    result = research_demo.observations("demo-steady", 7)
    DemoObservationsResponse.model_validate(result)
    assert result["start_date"] == "2026-08-24"
    assert result["end_date"] == "2026-08-30"
    assert result["available_observations"] == 6
    assert result["coverage_status"] == "partial"


def test_seven_day_baseline_uses_the_prior_seven_rows():
    profile = next(row for row in load_dataset()["profiles"] if row["id"] == "demo-steady")
    result = calculate_baseline("demo-steady", 7)
    expected = sum(row["total_screen_time_minutes"] for row in profile["observations"][-14:-7]) / 7
    assert result["baseline_period"]["observations"] == 7
    assert result["metrics"]["screen_time"]["baseline"] == round(expected, 2)


def test_baseline_metric_requires_five_valid_values(monkeypatch):
    import research_demo

    profile = next(row for row in load_dataset()["profiles"] if row["id"] == "demo-steady")
    sparse_rows = [dict(row) for row in profile["observations"]]
    for row in sparse_rows[-14:-11]:
        row["total_screen_time_minutes"] = None
    sparse = {**profile, "observations": sparse_rows}
    monkeypatch.setattr(research_demo, "get_profile", lambda _user_id: sparse)
    baseline = research_demo.calculate_baseline("demo-steady", 7)
    assert baseline["metrics"]["screen_time"]["baseline"] is None


def test_daily_baselines_do_not_look_ahead_and_alerts_are_marked_synthetic():
    profile = next(row for row in load_dataset()["profiles"] if row["id"] == "demo-steady")
    result = build_analysis("demo-steady", 30)
    observations = result["observations"]
    expected = sum(row["total_screen_time_minutes"] for row in profile["observations"][:7]) / 7
    assert observations[0]["baseline_values"] == {}
    assert observations[7]["baseline_values"]["screen_time"] == round(expected, 2)
    assert all(alert["status"] == "simulated" for alert in result["alerts"])
    assert result["source"] == "synthetic_demo"

    # Day-level deviation uses that date's value minus the mean of only the preceding 7 rows.
    for index, item in enumerate(observations):
        if index < 7:
            assert item["deviations"]["screen_time"] is None
        else:
            prior_week = profile["observations"][index - 7:index]
            expected_baseline = sum(row["total_screen_time_minutes"] for row in prior_week) / 7
            expected_delta = round(item["total_screen_time_minutes"] - expected_baseline, 2)
            assert item["deviations"]["screen_time"]["baseline"] == round(expected_baseline, 2)
            assert item["deviations"]["screen_time"]["difference"] == expected_delta

    # The first two dates do not have the three observations required by the rule window.
    assert [item["rule_score"] for item in observations[:2]] == [None, None]
    assert [item["risk_level"] for item in observations[:2]] == ["insufficient_observations"] * 2
    for index, item in enumerate(observations):
        if index < 2:
            continue
        recent = profile["observations"][max(0, index - 6):index + 1]
        means = {
            "screen": sum(row["total_screen_time_minutes"] for row in recent) / len(recent),
            "late": sum(row["late_night_usage_minutes"] for row in recent) / len(recent),
            "sleep": sum(row["sleep_duration_minutes"] for row in recent) / len(recent),
            "mood": sum(row["mood_score"] for row in recent) / len(recent),
            "stress": sum(row["stress_score"] for row in recent) / len(recent),
            "anxiety": sum(row["anxiety_score"] for row in recent) / len(recent),
        }
        expected_score = sum((
            means["screen"] > 360,
            means["late"] > 30,
            means["sleep"] < 420,
            means["mood"] <= 5,
            means["stress"] >= 6,
            means["anxiety"] >= 6,
        ))
        expected_level = "elevated" if expected_score >= 4 else "monitor" if expected_score >= 2 else "stable"
        assert item["rule_score"] == expected_score
        assert item["risk_level"] == expected_level


def test_invalid_windows_and_unknown_profiles_are_rejected():
    with pytest.raises(HTTPException) as invalid_window:
        validate_window(14)
    assert invalid_window.value.status_code == 422
    with pytest.raises(HTTPException) as missing_profile:
        select_observations("real-user-id", 7)
    assert missing_profile.value.status_code == 404
    with pytest.raises(ValidationError):
        PredictionRequest(user_id="real-account-id", days=14)


def test_api_handler_contract_reports_demo_source_and_rejects_other_windows():
    details = metadata()
    assert details["source"] == "synthetic_demo"
    assert details["profile_count"] == 3

    profile_list = users()
    user_id = profile_list[0]["id"]
    rows = observations(user_id, 30)
    assert len(rows["observations"]) == 30
    assert rows["source"] == "synthetic_demo"
    BaselineResponse.model_validate(calculate_baseline(user_id, 30))
    AnalysisResponse.model_validate(build_analysis(user_id, 30))
    demo_api = __import__("research_demo")
    ModelsResponse.model_validate(demo_api.models())
    demo_api.AlertsResponse.model_validate(demo_api.alerts(user_id, 7))
    with pytest.raises(HTTPException) as invalid:
        observations(user_id, 14)
    assert invalid.value.status_code == 422


def test_missing_or_corrupt_model_artifacts_are_unavailable():
    from pipeline import load_production_bundle

    with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as artifact_dir:
        assert load_production_bundle(artifact_dir) is None
        (Path(artifact_dir) / "production.joblib").write_bytes(b"not a joblib artifact")
        assert load_production_bundle(artifact_dir) is None


def test_demo_assistant_answers_from_selected_synthetic_profile_and_window(monkeypatch):
    import research_demo

    monkeypatch.setattr('llm.chat_provider_available', lambda: False)
    response = research_demo.demo_assistant(
        research_demo.DemoAssistantRequest(
            user_id='demo-steady', days=30,
            question='How did screen time and sleep change over the last 30 days?',
        )
    )
    expected = calculate_baseline('demo-steady', 30)
    assert response['source'] == 'synthetic_demo'
    assert response['assistant_mode'] == 'computed_fallback'
    assert response['user_id'] == 'demo-steady'
    assert response['days'] == 30
    assert response['available_observations'] == 30
    assert response['start_date'] == '2026-08-01'
    assert response['end_date'] == '2026-08-30'
    assert f"{expected['metrics']['screen_time']['baseline']:g}" in response['reply']
    assert f"{expected['metrics']['sleep']['baseline']:g}" in response['reply']
    assert 'not an LLM answer' in response['provider_note']


def test_demo_assistant_scopes_answers_to_requested_profile(monkeypatch):
    import research_demo

    monkeypatch.setattr('llm.chat_provider_available', lambda: False)
    answers = [
        research_demo.demo_assistant(research_demo.DemoAssistantRequest(
            user_id=profile, days=30, question='Which day had the highest stress?'))
        for profile in ('demo-steady', 'demo-high-digital')
    ]
    assert [answer['user_id'] for answer in answers] == ['demo-steady', 'demo-high-digital']
    assert all(answer['assistant_mode'] == 'computed_fallback' for answer in answers)
    assert answers[0]['reply'] != answers[1]['reply']
    for profile, answer in zip(('demo-steady', 'demo-high-digital'), answers):
        rows = select_observations(profile, 30)
        maximum = max(row['stress_score'] for row in rows)
        assert f'{maximum}/10' in answer['reply']


def test_demo_assistant_does_not_invent_answers_when_llm_unavailable(monkeypatch):
    import research_demo

    monkeypatch.setattr('llm.chat_provider_available', lambda: False)
    response = research_demo.demo_assistant(research_demo.DemoAssistantRequest(
        user_id='demo-steady', days=7, question='Tell me what will happen to me next year.'))
    assert response['assistant_mode'] == 'unavailable'
    assert 'cannot answer' in response['reply']
    assert 'synthetic_demo' == response['source']


def test_demo_assistant_reports_missing_model_instead_of_synthesizing_predictions(monkeypatch):
    import research_demo

    monkeypatch.setattr('llm.chat_provider_available', lambda: False)
    monkeypatch.setattr(research_demo, 'available_model', lambda: {
        'available': False, 'model_status': 'artifact_missing', 'models': [], 'evaluation': None,
    })
    response = research_demo.demo_assistant(research_demo.DemoAssistantRequest(
        user_id='demo-steady', days=7, question='What are the model predictions and evaluation metrics?'))
    assert response['assistant_mode'] == 'computed_fallback'
    assert 'artifact_missing' in response['reply']
    assert 'unavailable' in response['reply']


def test_demo_assistant_rejects_unknown_profile():
    import research_demo

    with pytest.raises(HTTPException) as missing:
        research_demo.demo_assistant(research_demo.DemoAssistantRequest(
            user_id='demo-unknown', days=7, question='How is the pattern?'))
    assert missing.value.status_code == 404
