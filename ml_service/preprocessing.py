from typing import Any, Dict

import numpy as np
import pandas as pd

REQUIRED_ANY = ("screen_time", "total_screen_time_minutes", "sleep_duration", "sleep_duration_minutes")


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    out = df.copy()
    numeric_cols = out.select_dtypes(include=[np.number]).columns
    if len(numeric_cols):
        out[numeric_cols] = out[numeric_cols].fillna(out[numeric_cols].median())

    cat_cols = out.select_dtypes(include=["object", "category"]).columns
    for col in cat_cols:
        if col == "date":
            continue
        if not out[col].mode().empty:
            out[col] = out[col].fillna(out[col].mode()[0])
    return out


def validate_input(data: Dict[str, Any]) -> bool:
    return any(key in data for key in REQUIRED_ANY)


def validate_frame(df: pd.DataFrame) -> bool:
    if df is None or df.empty:
        return False
    return any(col in df.columns for col in REQUIRED_ANY)
