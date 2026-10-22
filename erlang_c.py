"""Aggregate call history and compute Erlang C staffing targets."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any, Mapping

import pandas as pd


DEFAULT_SLA = 0.80
DEFAULT_WAIT_SECONDS = 20.0
DEFAULT_START_TIME = "07:00"
DEFAULT_END_TIME = "22:00"
INTERVAL_SECONDS = 30 * 60


def erlang_c_probability(offered_load: float, agents: int) -> float:
    """Probability an arriving call waits, for offered_load Erlangs."""
    if offered_load <= 0:
        return 0.0
    if agents <= 0 or agents <= offered_load:
        return 1.0
    term = 1.0
    denominator = 1.0
    for k in range(1, agents):
        term *= offered_load / k
        denominator += term
    last_term = term * offered_load / agents
    numerator = last_term * agents / (agents - offered_load)
    return float(min(1.0, max(0.0, numerator / (denominator + numerator))))


def service_level(
    offered_load: float,
    agents: int,
    aht_seconds: float,
    target_wait_seconds: float,
) -> float:
    """Probability a call is answered within the target wait time."""
    if offered_load <= 0 or aht_seconds <= 0:
        return 1.0
    wait_probability = erlang_c_probability(offered_load, agents)
    decay = math.exp(-max(0.0, agents - offered_load) * target_wait_seconds / aht_seconds)
    return float(min(1.0, max(0.0, 1.0 - wait_probability * decay)))


def minimum_agents(
    lambda_per_second: float,
    aht_seconds: float,
    sla_target: float = DEFAULT_SLA,
    target_wait_seconds: float = DEFAULT_WAIT_SECONDS,
    *,
    max_agents: int = 10_000,
) -> int:
    """Find the smallest integer staffing level meeting the SLA."""
    if not 0 < sla_target <= 1:
        raise ValueError("sla_target must be in the interval (0, 1]")
    if target_wait_seconds < 0:
        raise ValueError("target_wait_seconds cannot be negative")
    if lambda_per_second < 0 or aht_seconds < 0:
        raise ValueError("lambda_per_second and aht_seconds cannot be negative")
    offered_load = lambda_per_second * aht_seconds
    if offered_load <= 0:
        return 0
    agents = max(1, math.ceil(offered_load))
    while agents <= max_agents:
        if service_level(offered_load, agents, aht_seconds, target_wait_seconds) >= sla_target:
            return agents
        agents += 1
    raise ValueError(f"No staffing level up to max_agents={max_agents} meets the SLA")


def _minutes_from_hhmm(value: str) -> int:
    try:
        hour_text, minute_text = value.strip().split(":", 1)
        hour, minute = int(hour_text), int(minute_text)
    except (AttributeError, ValueError) as exc:
        raise ValueError(f"Invalid time {value!r}; expected HH:MM") from exc
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"Invalid time {value!r}; expected HH:MM")
    return hour * 60 + minute


def _hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def build_staffing_requirements(
    frame: pd.DataFrame,
    *,
    sla_target: float = DEFAULT_SLA,
    target_wait_seconds: float = DEFAULT_WAIT_SECONDS,
    start_time: str = DEFAULT_START_TIME,
    end_time: str = DEFAULT_END_TIME,
    output_date: str | None = None,
) -> dict[str, Any]:
    """Build the Module 1 JSON contract from a raw call-log DataFrame."""
    required = {"timestamp_arrival", "call_duration_seconds"}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f"CSV is missing required columns: {sorted(missing)}")
    if frame.empty:
        raise ValueError("The call log is empty")

    work = frame.copy()
    work["timestamp_arrival"] = pd.to_datetime(work["timestamp_arrival"], errors="coerce")
    work = work.loc[work["timestamp_arrival"].notna()].copy()
    if work.empty:
        raise ValueError("timestamp_arrival contains no parseable values")
    work["call_duration_seconds"] = pd.to_numeric(
        work["call_duration_seconds"], errors="coerce"
    ).fillna(0.0)
    if "abandoned" in work:
        work["_abandoned"] = work["abandoned"].astype(str).str.lower().isin({"true", "1", "yes", "y"})
    else:
        work["_abandoned"] = False
    work["_date"] = work["timestamp_arrival"].dt.date.astype(str)
    work["_minute"] = (
        work["timestamp_arrival"].dt.hour * 60
        + (work["timestamp_arrival"].dt.minute // 30) * 30
    )

    dates = sorted(work["_date"].unique().tolist())
    start_minute = _minutes_from_hhmm(start_time)
    end_minute = _minutes_from_hhmm(end_time)
    if end_minute <= start_minute or (end_minute - start_minute) % 30:
        raise ValueError("start_time/end_time must define positive 30-minute intervals")

    answered = work.loc[
        (~work["_abandoned"]) & (work["call_duration_seconds"] > 0), "call_duration_seconds"
    ]
    global_aht = float(answered.mean()) if not answered.empty else 0.0
    if global_aht <= 0:
        raise ValueError("No answered calls with positive call_duration_seconds were found")
    all_pairs = pd.MultiIndex.from_product(
        [dates, range(start_minute, end_minute, 30)], names=["_date", "_minute"]
    )
    counts = (
        work.groupby(["_date", "_minute"], observed=True)
        .size()
        .reindex(all_pairs, fill_value=0)
        .rename("calls")
    )
    bucket_aht = (
        work.loc[(~work["_abandoned"]) & (work["call_duration_seconds"] > 0)]
        .groupby("_minute", observed=True)["call_duration_seconds"]
        .mean()
    )

    intervals: list[dict[str, Any]] = []
    for minute in range(start_minute, end_minute, 30):
        average_calls = float(counts.xs(minute, level="_minute").mean())
        aht = float(bucket_aht.get(minute, global_aht))
        lambda_per_second = average_calls / INTERVAL_SECONDS
        offered_load = lambda_per_second * aht
        required_agents = minimum_agents(
            lambda_per_second,
            aht,
            sla_target=sla_target,
            target_wait_seconds=target_wait_seconds,
        )
        intervals.append(
            {
                "time_start": _hhmm(minute),
                "time_end": _hhmm(minute + 30),
                "average_calls": round(average_calls, 4),
                "lambda_per_second": round(lambda_per_second, 8),
                "aht_seconds": round(aht, 4),
                "offered_load_erlangs": round(offered_load, 4),
                "required_agents": int(required_agents),
                "achieved_service_level": round(
                    service_level(offered_load, required_agents, aht, target_wait_seconds), 6
                ),
            }
        )

    return {
        "schema_version": "1.0",
        "date": output_date or dates[0],
        "historical_date_range": {"start": dates[0], "end": dates[-1]},
        "historical_days": len(dates),
        "sla_target": float(sla_target),
        "wait_time_target_seconds": float(target_wait_seconds),
        "aht_seconds": round(global_aht, 4),
        "interval_seconds": INTERVAL_SECONDS,
        "intervals": intervals,
    }


def process_csv(
    input_csv: str | Path,
    *,
    sla_target: float = DEFAULT_SLA,
    target_wait_seconds: float = DEFAULT_WAIT_SECONDS,
    start_time: str = DEFAULT_START_TIME,
    end_time: str = DEFAULT_END_TIME,
    output_date: str | None = None,
) -> dict[str, Any]:
    return build_staffing_requirements(
        pd.read_csv(input_csv),
        sla_target=sla_target,
        target_wait_seconds=target_wait_seconds,
        start_time=start_time,
        end_time=end_time,
        output_date=output_date,
    )


def write_contract(contract: Mapping[str, Any], output: str | Path) -> None:
    destination = Path(output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(contract, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path("staffing_requirements.json"))
    parser.add_argument("--sla", type=float, default=DEFAULT_SLA)
    parser.add_argument("--wait-seconds", type=float, default=DEFAULT_WAIT_SECONDS)
    parser.add_argument("--start-time", default=DEFAULT_START_TIME)
    parser.add_argument("--end-time", default=DEFAULT_END_TIME)
    parser.add_argument("--date", dest="output_date")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    contract = process_csv(
        args.input,
        sla_target=args.sla,
        target_wait_seconds=args.wait_seconds,
        start_time=args.start_time,
        end_time=args.end_time,
        output_date=args.output_date,
    )
    write_contract(contract, args.output)
    print(f"Wrote {len(contract['intervals'])} staffing intervals to {args.output}")


if __name__ == "__main__":
    main()
