"""Train the local inference bundle from a consented, labelled CSV."""

import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
load_dotenv(PROJECT_ROOT / ".env.local")

from pipeline import MIN_SAMPLES, train_and_evaluate  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="CSV with daily features and a wellbeing_score label")
    args = parser.parse_args()

    source = args.csv.resolve()
    if not source.is_file():
        parser.error(f"CSV not found: {source}")

    records = pd.read_csv(source)
    if "wellbeing_score" not in records.columns:
        parser.error("CSV must contain a wellbeing_score column with participant-reported labels.")
    records["wellbeing_score"] = pd.to_numeric(records["wellbeing_score"], errors="coerce")
    records = records.loc[records["wellbeing_score"].notna()]
    if len(records) < MIN_SAMPLES:
        parser.error(f"Need at least {MIN_SAMPLES} rows with valid wellbeing_score labels; found {len(records)}.")
    if not records["wellbeing_score"].between(1, 10).all():
        parser.error("wellbeing_score values must be between 1 and 10.")

    model_path = Path(os.getenv("MODEL_PATH", "./ml_service/models"))
    model_dir = model_path if model_path.is_absolute() else (PROJECT_ROOT / model_path).resolve()
    result = train_and_evaluate(records, task="regression", model_dir=str(model_dir))
    print(json.dumps(result.__dict__, indent=2, default=str))
    return 0 if result.status == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
