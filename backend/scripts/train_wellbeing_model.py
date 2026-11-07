"""
CLI entry point: trains and evaluates the wellbeing-estimation models
against a real exported dataset.

Usage:
    python scripts/train_wellbeing_model.py --input data/export.csv --task regression
    python scripts/train_wellbeing_model.py --input data/export.csv --task classification
    python scripts/train_wellbeing_model.py --input data/export.csv --task both --save

--input must be a CSV produced by scripts/export_training_data.sql against
a real Supabase project (or an equivalent real dataset with the same
columns — see app/ml/data/validation.py's REQUIRED_COLUMNS). This script
never generates its own data to train on.

Without --save, this only prints the evaluation report — nothing is
written anywhere. With --save, writes ml_models rows via
app/services/ml_prediction_service.py (which requires
SUPABASE_SERVICE_ROLE_KEY to be set).

If the dataset doesn't meet app.ml.data.validation.MIN_ROWS_FOR_TRAINING,
this script exits with the message "Model evaluation requires sufficient
research data." and does NOT train or report anything — this is the
command-line enforcement of that requirement from the spec.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allows running as `python scripts/train_wellbeing_model.py` from the
# backend/ directory without needing PYTHONPATH set or the package
# installed in editable mode first.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from app.ml.data.features import build_features
from app.ml.data.validation import validate
from app.ml.models.registry import build_records
from app.ml.models.train import train_classification_models, train_regression_models


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Path to the exported CSV.")
    parser.add_argument("--task", choices=["regression", "classification", "both"], default="both")
    parser.add_argument(
        "--save", action="store_true", help="Persist results via ml_prediction_service (requires service-role key)."
    )
    args = parser.parse_args()

    raw = pd.read_csv(args.input)
    clean, report = validate(raw)
    print(report.summary())

    if not report.sufficient_for_training:
        # Deliberately exits here rather than falling through to any code
        # path that could train or print a metric.
        print("\nModel evaluation requires sufficient research data.")
        return 1

    if report.out_of_range_counts:
        print(f"Dropped out-of-range values: {report.out_of_range_counts}")
    if report.dropped_reasons:
        print(f"Dropped rows: {report.dropped_reasons}")

    feats = build_features(clean)
    print(f"\n{len(feats)} feature rows across {feats['user_id'].nunique()} users "
          f"({feats.attrs['n_dropped_for_insufficient_history']} rows dropped for insufficient per-user history).")

    runs = []
    if args.task in ("regression", "both"):
        print("\n=== Regression: estimating wellbeing_score ===")
        run = train_regression_models(feats)
        print(run.summary_table().to_string(index=False))
        if run.skipped_models:
            print(f"Skipped: {run.skipped_models}")
        print(f"Best model: {run.best_model.model_name} (lowest MAE)")
        runs.append(run)

    if args.task in ("classification", "both"):
        print("\n=== Classification: estimating wellbeing_risk_label ===")
        try:
            run = train_classification_models(feats)
        except ValueError as e:
            print(f"Skipping classification: {e}")
        else:
            print(run.summary_table().to_string(index=False))
            if run.skipped_models:
                print(f"Skipped: {run.skipped_models}")
            print(f"Best model: {run.best_model.model_name} (highest macro F1)")
            runs.append(run)

    if args.save:
        from app.services.ml_prediction_service import save_training_run

        for run in runs:
            records = build_records(run, feats)
            save_training_run(records)
            print(f"\nSaved {len(records)} model record(s) for task '{run.task}' to ml_models.")
    else:
        print("\n(--save not passed; nothing was written.)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
