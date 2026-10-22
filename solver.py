"""CP-SAT shift scheduler for the staffing requirements JSON contract.

The input employee records contain employee_id, skills and contracted_hours.
Optional availability fields are available_dates, unavailable_dates and
available_weekdays. A selected shift is nine elapsed hours: four paid hours,
one unpaid break, and four paid hours. Understaffing and overstaffing are soft
constraints with weights 100 and 10.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from datetime import date as Date
from datetime import datetime, time, timedelta
from pathlib import Path
from typing import Any, Mapping, Sequence

WORK_MINUTES = 8 * 60
REST_MINUTES = 12 * 60
SLOT_MINUTES = 30
UNDERSTAFFING_PENALTY = 100
OVERSTAFFING_PENALTY = 10


@dataclass(frozen=True)
class Employee:
    employee_id: str
    skills: frozenset[str]
    contracted_hours: float
    available_dates: frozenset[str] | None = None
    unavailable_dates: frozenset[str] = frozenset()
    available_weekdays: frozenset[int] | None = None


@dataclass(frozen=True)
class Demand:
    demand_index: int
    date: Date
    start: datetime
    end: datetime
    required_agents: int
    skills: frozenset[str]
    time_start: str
    time_end: str


@dataclass(frozen=True)
class Shift:
    date: Date
    start: datetime
    break_start: datetime
    break_end: datetime
    end: datetime

    def covers(self, interval_start: datetime, interval_end: datetime) -> bool:
        first_segment = self.start < interval_end and interval_start < self.break_start
        second_segment = self.break_end < interval_end and interval_start < self.end
        return bool(first_segment or second_segment)


def _cp_model():
    try:
        from ortools.sat.python import cp_model
    except ImportError as exc:
        raise RuntimeError(
            "OR-Tools is required to run solver.py. Install it with: pip install ortools"
        ) from exc
    return cp_model


def _string_set(value: Any) -> frozenset[str]:
    if value is None:
        return frozenset()
    values = [value] if isinstance(value, str) else value
    return frozenset(str(item).strip().lower() for item in values if str(item).strip())


def _weekday_set(value: Any) -> frozenset[int] | None:
    if value is None:
        return None
    names = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }
    values = [value] if isinstance(value, (str, int)) else value
    result: set[int] = set()
    for item in values:
        weekday = int(item) if isinstance(item, int) or str(item).isdigit() else names.get(str(item).lower(), -1)
        if weekday not in range(7):
            raise ValueError(f"Invalid weekday value: {item!r}")
        result.add(weekday)
    return frozenset(result)


def load_employees(path: str | Path) -> list[Employee]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = payload.get("employees", payload) if isinstance(payload, Mapping) else payload
    if not isinstance(rows, Sequence) or isinstance(rows, (str, bytes)):
        raise ValueError("employees JSON must be a list or an object containing employees")
    employees: list[Employee] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, Mapping):
            raise ValueError("Each employee must be a JSON object")
        employee_id = str(row.get("employee_id", row.get("id", ""))).strip()
        if not employee_id:
            raise ValueError("Each employee needs employee_id")
        if employee_id in seen:
            raise ValueError(f"Duplicate employee_id: {employee_id}")
        seen.add(employee_id)
        hours = float(row.get("contracted_hours", row.get("contract_hours", 40)))
        if hours < 0:
            raise ValueError(f"contracted_hours cannot be negative for {employee_id}")
        available_dates = row.get("available_dates", row.get("working_dates"))
        if isinstance(available_dates, str):
            available_dates = [available_dates]
        employees.append(
            Employee(
                employee_id=employee_id,
                skills=_string_set(row.get("skills", [])),
                contracted_hours=hours,
                available_dates=(
                    frozenset(str(item) for item in available_dates)
                    if available_dates is not None
                    else None
                ),
                unavailable_dates=_string_set(row.get("unavailable_dates", [])),
                available_weekdays=_weekday_set(row.get("available_weekdays")),
            )
        )
    if not employees:
        raise ValueError("employees JSON contains no employees")
    return employees


def _parse_date(value: Any) -> Date:
    try:
        return Date.fromisoformat(str(value))
    except ValueError as exc:
        raise ValueError(f"Invalid planning date: {value!r}") from exc


def _parse_clock(value: Any) -> time:
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(str(value), fmt).time()
        except ValueError:
            pass
    raise ValueError(f"Invalid interval time {value!r}; expected HH:MM")


def _planning_dates(contract: Mapping[str, Any]) -> list[Date]:
    values = contract.get("planning_dates", contract.get("dates"))
    if values is None:
        values = [contract.get("date")]
    dates = sorted({_parse_date(value) for value in values if value is not None})
    if not dates:
        raise ValueError("staffing contract needs date or planning_dates")
    return dates


def _demand_rows(contract: Mapping[str, Any]) -> list[Demand]:
    dates = _planning_dates(contract)
    intervals = contract.get("intervals")
    if not isinstance(intervals, Sequence) or isinstance(intervals, (str, bytes)):
        raise ValueError("staffing contract intervals must be a list")
    demands: list[Demand] = []
    demand_index = 0
    for row in intervals:
        if not isinstance(row, Mapping):
            raise ValueError("Each staffing interval must be an object")
        required_default = int(row.get("required_agents", 0))
        if required_default < 0:
            raise ValueError("required_agents cannot be negative")
        interval_dates = [_parse_date(row["date"])] if row.get("date") else dates
        start_clock = _parse_clock(row["time_start"])
        end_clock = _parse_clock(row["time_end"])
        required_skills = row.get("required_skills", row.get("skill", row.get("required_skill")))
        if isinstance(row.get("skill_requirements"), Mapping):
            specs = [
                (int(required), _string_set(skill))
                for skill, required in row["skill_requirements"].items()
            ]
        elif isinstance(row.get("skill_requirements"), Sequence) and not isinstance(
            row["skill_requirements"], (str, bytes)
        ):
            specs = [
                (int(spec["required_agents"]), _string_set(spec.get("skill")))
                for spec in row["skill_requirements"]
            ]
        else:
            specs = [(required_default, _string_set(required_skills))]
        for day in interval_dates:
            start = datetime.combine(day, start_clock)
            end = datetime.combine(day, end_clock)
            if end <= start:
                end += timedelta(days=1)
            for required_agents, skills in specs:
                if required_agents < 0:
                    raise ValueError("required_agents cannot be negative")
                demands.append(
                    Demand(
                        demand_index=demand_index,
                        date=day,
                        start=start,
                        end=end,
                        required_agents=required_agents,
                        skills=skills,
                        time_start=str(row["time_start"]),
                        time_end=str(row["time_end"]),
                    )
                )
                demand_index += 1
    if not demands:
        raise ValueError("staffing contract contains no demand intervals")
    return demands


def _floor_half_hour(value: datetime) -> datetime:
    return value.replace(
        minute=(value.minute // SLOT_MINUTES) * SLOT_MINUTES,
        second=0,
        microsecond=0,
    )


def _candidate_shifts(demands: Sequence[Demand], dates: Sequence[Date]) -> dict[Date, list[Shift]]:
    shifts_by_day: dict[Date, list[Shift]] = {}
    for day in dates:
        day_demands = [demand for demand in demands if demand.date == day]
        if day_demands:
            # The latest shift that can overlap the first paid segment can
            # begin up to nine hours before demand (the second paid segment).
            earliest_start = _floor_half_hour(min(d.start for d in day_demands) - timedelta(hours=9))
            latest_start = _floor_half_hour(max(d.end for d in day_demands))
        else:
            earliest_start = datetime.combine(day, time(8, 0))
            latest_start = earliest_start
        current = max(datetime.combine(day, time(0, 0)), earliest_start)
        latest_start = min(datetime.combine(day, time(23, 30)), latest_start)
        shifts: list[Shift] = []
        while current <= latest_start:
            candidate = Shift(
                date=day,
                start=current,
                break_start=current + timedelta(hours=4),
                break_end=current + timedelta(hours=5),
                end=current + timedelta(hours=9),
            )
            if any(candidate.covers(demand.start, demand.end) for demand in day_demands):
                shifts.append(candidate)
            current += timedelta(minutes=SLOT_MINUTES)
        if not shifts:
            fallback = datetime.combine(day, time(8, 0))
            shifts.append(
                Shift(
                    date=day,
                    start=fallback,
                    break_start=fallback + timedelta(hours=4),
                    break_end=fallback + timedelta(hours=5),
                    end=fallback + timedelta(hours=9),
                )
            )
        shifts_by_day[day] = shifts
    return shifts_by_day


def _eligible(employee: Employee, skills: frozenset[str]) -> bool:
    return not skills or skills.issubset(employee.skills)


def _available(employee: Employee, day: Date) -> bool:
    day_text = day.isoformat()
    if employee.available_dates is not None and day_text not in employee.available_dates:
        return False
    if day_text in employee.unavailable_dates:
        return False
    return employee.available_weekdays is None or day.weekday() in employee.available_weekdays


def _clock_text(value: datetime, day: Date) -> str:
    return value.strftime("%H:%M") if value.date() == day else value.isoformat(timespec="minutes")


def solve_contract(
    contract: Mapping[str, Any],
    employees: Sequence[Employee],
    *,
    time_limit_seconds: float = 30.0,
    num_workers: int = 8,
) -> dict[str, Any]:
    """Solve a staffing contract and return the Module 2 roster contract."""
    if time_limit_seconds <= 0:
        raise ValueError("time_limit_seconds must be positive")
    cp_model = _cp_model()
    demands = _demand_rows(contract)
    dates = _planning_dates(contract)
    shifts_by_day = _candidate_shifts(demands, dates)
    model = cp_model.CpModel()

    variables: dict[tuple[int, Date, int], Any] = {}
    by_employee_day: dict[tuple[int, Date], list[Any]] = {}
    for employee_index, employee in enumerate(employees):
        max_weekly_shifts = int(math.floor(employee.contracted_hours / 8.0))
        for day in dates:
            day_vars: list[Any] = []
            for shift_index, _shift in enumerate(shifts_by_day[day]):
                variable = model.NewBoolVar(f"works_{employee_index}_{day}_{shift_index}")
                variables[(employee_index, day, shift_index)] = variable
                day_vars.append(variable)
                if not _available(employee, day):
                    model.Add(variable == 0)
            by_employee_day[(employee_index, day)] = day_vars
            model.Add(sum(day_vars) <= 1)

        week_groups: dict[tuple[int, int], list[Date]] = {}
        for day in dates:
            iso_year, iso_week, _ = day.isocalendar()
            week_groups.setdefault((iso_year, iso_week), []).append(day)
        for week_days in week_groups.values():
            model.Add(
                sum(
                    variable
                    for day in week_days
                    for variable in by_employee_day[(employee_index, day)]
                )
                <= max_weekly_shifts
            )

        worked_day: dict[Date, Any] = {}
        for day in dates:
            worked_day[day] = model.NewBoolVar(f"worked_{employee_index}_{day}")
            model.Add(worked_day[day] == sum(by_employee_day[(employee_index, day)]))
        for start_index in range(max(0, len(dates) - 5)):
            window = dates[start_index : start_index + 6]
            if (window[-1] - window[0]).days == 5:
                model.Add(sum(worked_day[day] for day in window) <= 5)

        # A nine-hour shift followed by twelve hours of rest requires 21 hours
        # between starts. For this candidate horizon, only adjacent calendar
        # days can violate it; same-day duplicates are already forbidden.
        for left_day, right_day in zip(dates, dates[1:]):
            if (right_day - left_day).days != 1:
                continue
            for left_index, left_shift in enumerate(shifts_by_day[left_day]):
                left_var = variables[(employee_index, left_day, left_index)]
                conflicting_right_vars: list[Any] = []
                for right_index, right_shift in enumerate(shifts_by_day[right_day]):
                    rest = (right_shift.start - left_shift.end).total_seconds() / 60
                    if rest < REST_MINUTES:
                        right_var = variables[(employee_index, right_day, right_index)]
                        conflicting_right_vars.append(right_var)
                if conflicting_right_vars:
                    model.Add(left_var + sum(conflicting_right_vars) <= 1)

    under_vars: list[Any] = []
    over_vars: list[Any] = []
    cover_sets: dict[int, list[tuple[int, Date, int]]] = {}
    for demand in demands:
        covering: list[Any] = []
        keys: list[tuple[int, Date, int]] = []
        for employee_index, employee in enumerate(employees):
            if not _eligible(employee, demand.skills):
                continue
            for shift_index, shift in enumerate(shifts_by_day[demand.date]):
                if shift.covers(demand.start, demand.end):
                    key = (employee_index, demand.date, shift_index)
                    keys.append(key)
                    covering.append(variables[key])
        assigned = sum(covering) if covering else 0
        under = model.NewIntVar(0, demand.required_agents, f"under_{demand.demand_index}")
        over = model.NewIntVar(0, max(demand.required_agents, len(covering)), f"over_{demand.demand_index}")
        model.AddMaxEquality(under, [demand.required_agents - assigned, 0])
        model.AddMaxEquality(over, [assigned - demand.required_agents, 0])
        under_vars.append(under)
        over_vars.append(over)
        cover_sets[demand.demand_index] = keys

    penalty = sum(
        UNDERSTAFFING_PENALTY * under + OVERSTAFFING_PENALTY * over
        for under, over in zip(under_vars, over_vars, strict=True)
    )
    model.Minimize(penalty)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit_seconds)
    solver.parameters.num_search_workers = max(1, int(num_workers))
    solver.parameters.random_seed = 42
    status_code = solver.Solve(model)
    status = solver.StatusName(status_code)
    if status not in {"OPTIMAL", "FEASIBLE"}:
        return {
            "schema_version": "1.0",
            "status": status,
            "total_penalty_score": None,
            "roster": [],
            "coverage": [],
        }

    selected = {
        key for key, variable in variables.items() if solver.Value(variable) == 1
    }
    roster: list[dict[str, Any]] = []
    for employee_index, day, shift_index in sorted(selected, key=lambda item: (item[1], item[2], item[0])):
        shift = shifts_by_day[day][shift_index]
        roster.append(
            {
                "employee_id": employees[employee_index].employee_id,
                "date": day.isoformat(),
                "shift_start": _clock_text(shift.start, day),
                "shift_end": _clock_text(shift.end, day),
                "break_start": _clock_text(shift.break_start, day),
                "break_end": _clock_text(shift.break_end, day),
                "hours_worked": 8,
                "skills": sorted(employees[employee_index].skills),
            }
        )

    coverage: list[dict[str, Any]] = []
    total_penalty = 0
    for demand in demands:
        scheduled = sum(1 for key in cover_sets[demand.demand_index] if key in selected)
        understaffed = max(0, demand.required_agents - scheduled)
        overstaffed = max(0, scheduled - demand.required_agents)
        total_penalty += UNDERSTAFFING_PENALTY * understaffed + OVERSTAFFING_PENALTY * overstaffed
        coverage.append(
            {
                "date": demand.date.isoformat(),
                "time_start": demand.time_start,
                "time_end": demand.time_end,
                "required_agents": demand.required_agents,
                "scheduled_agents": scheduled,
                "understaffed": understaffed,
                "overstaffed": overstaffed,
                "skill": sorted(demand.skills),
            }
        )

    return {
        "schema_version": "1.0",
        "status": status,
        "total_penalty_score": int(total_penalty),
        "objective_value": solver.ObjectiveValue(),
        "roster": roster,
        "coverage": coverage,
    }


def solve_files(
    requirements_path: str | Path,
    employees_path: str | Path,
    output_path: str | Path,
    *,
    time_limit_seconds: float = 30.0,
    num_workers: int = 8,
) -> dict[str, Any]:
    requirements = json.loads(Path(requirements_path).read_text(encoding="utf-8"))
    result = solve_contract(
        requirements,
        load_employees(employees_path),
        time_limit_seconds=time_limit_seconds,
        num_workers=num_workers,
    )
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--requirements", type=Path, default=Path("staffing_requirements.json"))
    parser.add_argument("--employees", type=Path, default=Path("employees.json"))
    parser.add_argument("--output", type=Path, default=Path("optimized_roster.json"))
    parser.add_argument("--time-limit", type=float, default=30.0)
    parser.add_argument("--workers", type=int, default=8)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    result = solve_files(
        args.requirements,
        args.employees,
        args.output,
        time_limit_seconds=args.time_limit,
        num_workers=args.workers,
    )
    print(
        f"Status: {result['status']}; penalty: {result.get('total_penalty_score')}; "
        f"roster rows: {len(result.get('roster', []))}"
    )


if __name__ == "__main__":
    main()
