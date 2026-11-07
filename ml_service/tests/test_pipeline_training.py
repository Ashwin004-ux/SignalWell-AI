import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import _holdout_plan, prepare_xy  # noqa: E402


def test_holdout_keeps_participant_groups_separate():
    raw = pd.DataFrame({
        "user_id": [f"participant-{group}" for group in range(5) for _ in range(10)],
        "screen_time": np.arange(50) + 100,
        "sleep_duration": np.arange(50) + 400,
        "wellbeing_score": np.tile([4, 6], 25),
    })
    X, y = prepare_xy(raw)
    train_idx, test_idx, method, mode, groups = _holdout_plan(raw, X, y, "regression")
    assert mode == "group"
    assert "GroupShuffleSplit" in method
    assert set(groups[train_idx]).isdisjoint(set(groups[test_idx]))


def test_holdout_uses_strictly_later_dates_for_chronological_data():
    raw = pd.DataFrame({
        "date": pd.date_range("2026-01-01", periods=20).astype(str),
        "screen_time": np.arange(20) + 100,
        "sleep_duration": np.arange(20) + 400,
        "wellbeing_score": np.tile([4, 6], 10),
    })
    X, y = prepare_xy(raw)
    train_idx, test_idx, method, mode, _ = _holdout_plan(raw, X, y, "regression")
    dates = pd.to_datetime(raw.loc[X.index, "date"])
    assert mode == "time"
    assert "Chronological" in method
    assert dates.iloc[train_idx].max() < dates.iloc[test_idx].min()


def test_training_labels_must_be_numeric_and_within_documented_scale():
    raw = pd.DataFrame({"screen_time": [100, 120], "sleep_duration": [400, 420], "wellbeing_score": [4, 11]})
    with pytest.raises(ValueError, match="from 1 to 10"):
        prepare_xy(raw)

    raw["wellbeing_score"] = ["6", "not-a-number"]
    X, y = prepare_xy(raw)
    assert len(X) == 1
    assert y.iloc[0] == 6


def test_synthetic_fixture_training_reload_and_prediction_smoke():
    import json
    import tempfile

    from pipeline import load_production_bundle, predict_one, train_and_evaluate

    fixture_path = Path(__file__).resolve().parents[1] / 'data' / 'research_demo_v1.json'
    dataset = json.loads(fixture_path.read_text(encoding='utf-8'))
    raw = pd.DataFrame(
        row for profile in dataset['profiles'] for row in profile['observations']
    )
    assert len(raw) == 90
    assert set(raw['source']) == {'synthetic_demo'}

    with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as model_dir:
        trained = train_and_evaluate(raw, task='regression', model_dir=model_dir, run_ablation=False)
        assert trained.status == 'ok', trained.message

        bundle = load_production_bundle(model_dir)
        assert bundle is not None
        assert bundle['evaluation']['dataset_source'] == 'synthetic_demo'
        assert 'not evidence of real-world accuracy' in bundle['evaluation']['interpretation_note']
        assert bundle['evaluation']['held_out_records'] > 0

        prediction = predict_one(raw.iloc[0].to_dict(), model_dir=model_dir)
        assert prediction['status'] == 'ok'
        assert np.isfinite(float(prediction['prediction']))
