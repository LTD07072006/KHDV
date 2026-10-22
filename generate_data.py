"""Generate a month of synthetic call-centre history.

The generator uses a transparent statistical model: five-minute arrival
buckets contain two daily Gaussian peaks, weekday/weekend seasonality and
gamma noise.  Call-level answer and handling times are sampled afterwards.
No machine-learning forecast is involved.

Example:
    python generate_data.py --output data/call_logs.csv --seed 42
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd


DEFAULT_START_DATE = "2026-10-01"
DEFAULT_DAYS = 30
DEFAULT_TARGET_CALLS = 50_000
OPEN_MINUTE = 7 * 60
CLOSE_MINUTE = 22 * 60
BUCKET_MINUTES = 5


def _gaussian_peak(hour: np.ndarray, centre: float, width: float) -> np.ndarray:
    return np.exp(-0.5 * ((hour - centre) / width) ** 2)


def daily_call_weights(
    day: pd.Timestamp,
    bucket_starts: Iterable[pd.Timestamp],
    rng: np.random.Generator,
) -> np.ndarray:
    """Build noisy relative arrival weights for one day."""
    buckets = pd.DatetimeIndex(bucket_starts)
    decimal_hour = buckets.hour.to_numpy(dtype=float) + buckets.minute.to_numpy(dtype=float) / 60.0
    profile = (
        0.18
        + 1.55 * _gaussian_peak(decimal_hour, 10.0, 1.35)
        + 1.25 * _gaussian_peak(decimal_hour, 15.0, 1.65)
        + 0.20 * _gaussian_peak(decimal_hour, 12.8, 2.8)
    )
    weekday_multiplier = 1.0 if day.dayofweek < 5 else 0.76
    day_multiplier = float(rng.lognormal(mean=0.0, sigma=0.08))
    bucket_noise = rng.gamma(shape=8.0, scale=1.0 / 8.0, size=len(buckets))
    return np.maximum(profile * weekday_multiplier * day_multiplier * bucket_noise, 1e-12)


def _sample_timestamps(
    bucket_starts: pd.DatetimeIndex,
    bucket_counts: np.ndarray,
    rng: np.random.Generator,
) -> pd.DatetimeIndex:
    timestamps: list[pd.Timestamp] = []
    for bucket_start, count in zip(bucket_starts, bucket_counts, strict=True):
        if count <= 0:
            continue
        offsets = rng.integers(0, BUCKET_MINUTES * 60, size=int(count))
        timestamps.extend(bucket_start + pd.to_timedelta(offsets, unit="s"))
    return pd.DatetimeIndex(timestamps)


def generate_dataset(
    output: str | Path,
    *,
    start_date: str = DEFAULT_START_DATE,
    days: int = DEFAULT_DAYS,
    target_calls: int = DEFAULT_TARGET_CALLS,
    seed: int = 42,
) -> pd.DataFrame:
    """Generate and write a synthetic call log CSV."""
    if days <= 0:
        raise ValueError("days must be positive")
    if target_calls <= 0:
        raise ValueError("target_calls must be positive")

    rng = np.random.default_rng(seed)
    first_day = pd.Timestamp(start_date).normalize()
    dates = pd.date_range(first_day, periods=days, freq="D")
    desired_total = int(round(target_calls * float(rng.uniform(0.97, 1.03))))

    all_buckets: list[pd.Timestamp] = []
    all_weights: list[float] = []
    for day in dates:
        bucket_starts = pd.date_range(
            day + pd.Timedelta(minutes=OPEN_MINUTE),
            day + pd.Timedelta(minutes=CLOSE_MINUTE - BUCKET_MINUTES),
            freq=f"{BUCKET_MINUTES}min",
        )
        all_buckets.extend(bucket_starts.tolist())
        all_weights.extend(daily_call_weights(day, bucket_starts, rng).tolist())

    probabilities = np.asarray(all_weights, dtype=float)
    probabilities /= probabilities.sum()
    counts = rng.multinomial(desired_total, probabilities)
    arrivals = _sample_timestamps(pd.DatetimeIndex(all_buckets), counts, rng).sort_values()

    decimal_hour = arrivals.hour.to_numpy(dtype=float) + arrivals.minute.to_numpy(dtype=float) / 60.0
    peak_intensity = np.maximum(
        _gaussian_peak(decimal_hour, 10.0, 1.35),
        _gaussian_peak(decimal_hour, 15.0, 1.65),
    )
    abandon_probability = np.clip(0.025 + 0.055 * peak_intensity, 0.02, 0.13)
    abandoned = rng.random(len(arrivals)) < abandon_probability

    handling_seconds = np.rint(
        np.clip(rng.lognormal(mean=np.log(390.0), sigma=0.42, size=len(arrivals)), 45, 2_400)
    ).astype(np.int64)
    handling_seconds[abandoned] = 0

    wait_mean = 7.0 + 18.0 * peak_intensity
    waits = np.rint(np.clip(rng.lognormal(np.log(wait_mean), 0.48), 0, 240)).astype(np.int64)
    answered = pd.Series(arrivals + pd.to_timedelta(waits, unit="s"))
    answered.loc[abandoned] = pd.NaT

    frame = pd.DataFrame(
        {
            "call_id": [f"CALL_{number:07d}" for number in range(1, len(arrivals) + 1)],
            "timestamp_arrival": arrivals,
            "timestamp_answered": answered.to_numpy(),
            "call_duration_seconds": handling_seconds,
            "abandoned": abandoned.astype(bool),
        }
    ).sort_values("timestamp_arrival", ignore_index=True)

    destination = Path(output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(destination, index=False, date_format="%Y-%m-%dT%H:%M:%S")
    return frame


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("data/call_logs.csv"))
    parser.add_argument("--start-date", default=DEFAULT_START_DATE)
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS)
    parser.add_argument("--target-calls", type=int, default=DEFAULT_TARGET_CALLS)
    parser.add_argument("--seed", type=int, default=42)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    frame = generate_dataset(
        args.output,
        start_date=args.start_date,
        days=args.days,
        target_calls=args.target_calls,
        seed=args.seed,
    )
    print(f"Wrote {len(frame):,} calls to {args.output}")
    print(f"Answered rate: {1.0 - float(frame['abandoned'].mean()):.1%}")


if __name__ == "__main__":
    main()
