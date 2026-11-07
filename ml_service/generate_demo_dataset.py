"""Generate the versioned, fixed-seed research demo observations."""

import json
import random
from datetime import date, timedelta
from pathlib import Path


SEED = 731942
START = date(2026, 8, 1)
PROFILES = [
    {"id": "demo-steady", "label": "Synthetic profile A", "screen": 285, "social": 75, "sleep": 445, "stress": 4, "movement": 42},
    {"id": "demo-high-digital", "label": "Synthetic profile B", "screen": 430, "social": 135, "sleep": 405, "stress": 6, "movement": 28},
    {"id": "demo-variable-sleep", "label": "Synthetic profile C", "screen": 345, "social": 95, "sleep": 420, "stress": 5, "movement": 36},
]


def clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, value))


def build_dataset() -> dict:
    rng = random.Random(SEED)
    profiles = []
    for config in PROFILES:
        observations = []
        for day_index in range(1, 31):
            weekday_date = START + timedelta(days=day_index - 1)
            weekend = weekday_date.weekday() >= 5
            trend = (day_index - 15) * (2 if config["id"] == "demo-high-digital" else 0.4)
            screen = clamp(round(config["screen"] + trend + rng.gauss(0, 38) + (22 if weekend else 0)), 90, 700)
            social = clamp(round(config["social"] + (screen - config["screen"]) * 0.24 + rng.gauss(0, 16)), 10, min(360, screen))
            late = clamp(round((config["screen"] / 9) + rng.gauss(0, 14) + (15 if config["id"] == "demo-variable-sleep" and day_index % 4 == 0 else 0)), 0, 180)
            sleep = clamp(round(config["sleep"] + rng.gauss(0, 34) - (late - 35) * 0.35 + (18 if not weekend else 0)), 270, 560)
            movement = clamp(round(config["movement"] + rng.gauss(0, 13) + (12 if weekend else 0)), 0, 120)
            stress = clamp(round(config["stress"] + rng.gauss(0, 1.2) + (0.7 if screen > 480 else 0) + (0.6 if sleep < 360 else 0)), 1, 10)
            mood = clamp(round(7.2 - (stress - 4) * 0.48 + (sleep - 420) / 120 + rng.gauss(0, 0.8)), 1, 10)
            anxiety = clamp(round(stress + rng.gauss(-0.3, 1.0)), 1, 10)
            energy = clamp(round(5 + (sleep - 390) / 80 + rng.gauss(0, 0.9)), 1, 10)
            wellbeing = clamp(round((mood + energy + (11 - stress)) / 3 + rng.gauss(0, 0.45)), 1, 10)
            observations.append({
                "user_id": config["id"],
                "date": weekday_date.isoformat(),
                "day_index": day_index,
                "weekday": weekday_date.strftime("%A"),
                "total_screen_time_minutes": screen,
                "social_media_minutes": social,
                "late_night_usage_minutes": late,
                "notifications_count": clamp(round(screen / 3 + rng.gauss(0, 18)), 0, 600),
                "app_switches": clamp(round(screen / 10 + rng.gauss(0, 8)), 0, 160),
                "sleep_duration_minutes": sleep,
                "sleep_duration_hours": round(sleep / 60, 2),
                "physical_activity_minutes": movement,
                "study_work_minutes": clamp(screen - social - round(rng.uniform(10, 35)), 0, screen),
                "mood_score": mood,
                "stress_score": stress,
                "anxiety_score": anxiety,
                "energy_score": energy,
                "wellbeing_score": wellbeing,
                "target_kind": "synthetic_reference",
                "source": "synthetic_demo",
            })
        profiles.append({"id": config["id"], "label": config["label"], "observations": observations})
    return {
        "dataset_name": "SignalWell Research Demo Synthetic Observations",
        "version": "1.0.0",
        "source": "synthetic_demo",
        "seed": SEED,
        "profile_count": len(profiles),
        "days_per_profile": 30,
        "profiles": profiles,
    }


if __name__ == "__main__":
    output = Path(__file__).resolve().parent / "data" / "research_demo_v1.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(build_dataset(), indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output}")
