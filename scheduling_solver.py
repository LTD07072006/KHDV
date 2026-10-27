"""CP-SAT consumer for ``SchedulingRequest v1.0.0``.

This module is the active solver boundary. It never reads Excel and never
returns the old ``intervals``/``roster`` contract. Workbook input is converted
by :mod:`workbook_adapter` before this function is called.
"""

from __future__ import annotations

import time as clock
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Mapping

from scheduling_contract import validate_request, validate_result


def _timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError(f"Timestamp phải có múi giờ: {value}")
    return parsed


def _minutes_between(left: datetime, right: datetime) -> float:
    return (right - left).total_seconds() / 60


def _inside(outer_start: datetime, outer_end: datetime, inner_start: datetime, inner_end: datetime) -> bool:
    return outer_start <= inner_start and inner_end <= outer_end


def _covers(assignment: Mapping[str, Any], slot_start: datetime, slot_end: datetime) -> bool:
    if not (assignment["start_dt"] < slot_end and slot_start < assignment["end_dt"]):
        return False
    for break_item in assignment["breaks"]:
        break_start, break_end = break_item
        if break_start < slot_end and slot_start < break_end:
            return False
    return True


def _diagnostic(severity: str, code: str, message: str, path: str | None = None) -> dict[str, Any]:
    return {"severity": severity, "code": code, "message": message, "path": path}


def _empty_result(request: Mapping[str, Any], *, status: str, solver_status: str, diagnostics: list[dict[str, Any]]) -> dict[str, Any]:
    return validate_result({
        "contract_version": "1.0.0",
        "request_id": request.get("request_id", "unknown"),
        "timezone": request.get("timezone", "Asia/Ho_Chi_Minh"),
        "status": status,
        "solver_status": solver_status,
        "solution_source": "NONE",
        "has_solution": False,
        "optimality_proven": False,
        "assignments": [],
        "coverage": [],
        "metrics": None,
        "diagnostics": diagnostics,
        "carry_out": [],
    })


def solve_request(request: Mapping[str, Any]) -> dict[str, Any]:
    """Solve one validated request and return a validated result.

    The implementation covers the MVP contract: one day, 30-minute slots,
    fixed shift templates, skill/availability matching, one shift per local day,
    planned breaks, soft shortage/overstaff and deterministic solver settings.
    """

    try:
        request = validate_request(request)
    except (ValueError, RuntimeError) as exc:
        fallback = dict(request) if isinstance(request, Mapping) else {}
        return _empty_result(fallback, status="INVALID_INPUT", solver_status="MODEL_INVALID", diagnostics=[_diagnostic("ERROR", "INVALID_REQUEST", str(exc))])

    try:
        from ortools.sat.python import cp_model
    except ImportError as exc:  # pragma: no cover - dependency setup error
        return _empty_result(request, status="ERROR", solver_status="NOT_RUN", diagnostics=[_diagnostic("ERROR", "ORTOOLS_MISSING", str(exc))])

    try:
        slots = {row["slot_id"]: row for row in request["slots"]}
        demands = list(request["demand"])
        templates = list(request["shift_templates"])
        employees = list(request["employees"])
        if not templates or not employees:
            return _empty_result(request, status="INVALID_INPUT", solver_status="MODEL_INVALID", diagnostics=[_diagnostic("ERROR", "NO_CANDIDATES", "Request cần ít nhất một nhân viên và một mẫu ca.")])

        candidates: list[dict[str, Any]] = []
        for employee in employees:
            employee_skills = set(employee["skill_ids"])
            availability = [(_timestamp(item["start"]), _timestamp(item["end"])) for item in employee["availability"]]
            for template in templates:
                start_dt, end_dt = _timestamp(template["start"]), _timestamp(template["end"])
                if not any(_inside(a_start, a_end, start_dt, end_dt) for a_start, a_end in availability):
                    continue
                allowed_skills = employee_skills.intersection(template["allowed_skill_ids"])
                breaks = [(_timestamp(item["start"]), _timestamp(item["end"])) for item in template["breaks"]]
                for skill_id in sorted(allowed_skills):
                    candidates.append({
                        "employee_id": employee["employee_id"],
                        "template_id": template["template_id"],
                        "skill_id": skill_id,
                        "start_dt": start_dt,
                        "end_dt": end_dt,
                        "breaks": breaks,
                        "start": template["start"],
                        "end": template["end"],
                        "break_items": template["breaks"],
                    })
        if not candidates:
            return _empty_result(request, status="INVALID_INPUT", solver_status="MODEL_INVALID", diagnostics=[_diagnostic("ERROR", "NO_ELIGIBLE_ASSIGNMENTS", "Không có nhân viên nào phù hợp với mẫu ca, kỹ năng và thời gian rảnh.")])

        model = cp_model.CpModel()
        variables = [model.NewBoolVar(f"assign_{index}") for index in range(len(candidates))]
        by_employee_day: dict[tuple[str, date], list[Any]] = defaultdict(list)
        for index, candidate in enumerate(candidates):
            by_employee_day[(candidate["employee_id"], candidate["start_dt"].date())].append(variables[index])
        for values in by_employee_day.values():
            model.Add(sum(values) <= int(request["rules"]["max_shifts_per_local_day"]))

        max_minutes = {employee["employee_id"]: employee["max_scheduled_minutes_in_horizon"] for employee in employees}
        for employee_id, values in by_employee_day.items():
            employee_candidates = [index for index, item in enumerate(candidates) if (item["employee_id"], item["start_dt"].date()) == employee_id]
            model.Add(sum(int(_minutes_between(candidates[index]["start_dt"], candidates[index]["end_dt"]) - sum(_minutes_between(start, end) for start, end in candidates[index]["breaks"])) * variables[index] for index in employee_candidates) <= max_minutes[employee_id[0]])

        min_rest = request["rules"]["min_rest_minutes"]
        for left_index, left in enumerate(candidates):
            for right_index in range(left_index + 1, len(candidates)):
                right = candidates[right_index]
                if left["employee_id"] != right["employee_id"]:
                    continue
                if left["start_dt"].date() == right["start_dt"].date() or _minutes_between(left["end_dt"], right["start_dt"]) < min_rest or _minutes_between(right["end_dt"], left["start_dt"]) < min_rest:
                    model.Add(variables[left_index] + variables[right_index] <= 1)

        shortage_vars: list[Any] = []
        overstaff_vars: list[Any] = []
        coverage_keys: list[tuple[Mapping[str, Any], list[int]]] = []
        for demand in demands:
            slot = slots.get(demand["slot_id"])
            if slot is None:
                return _empty_result(request, status="INVALID_INPUT", solver_status="MODEL_INVALID", diagnostics=[_diagnostic("ERROR", "UNKNOWN_SLOT", f"Demand tham chiếu slot không tồn tại: {demand['slot_id']}", "/demand")])
            slot_start, slot_end = _timestamp(slot["start"]), _timestamp(slot["end"])
            indexes = [index for index, candidate in enumerate(candidates) if candidate["skill_id"] == demand["skill_id"] and _covers(candidate, slot_start, slot_end)]
            assigned = sum(variables[index] for index in indexes) if indexes else 0
            shortage = model.NewIntVar(0, int(demand["required_agents"]), f"shortage_{len(shortage_vars)}")
            overstaff = model.NewIntVar(0, max(1, len(indexes)), f"overstaff_{len(overstaff_vars)}")
            model.AddMaxEquality(shortage, [int(demand["required_agents"]) - assigned, 0])
            model.AddMaxEquality(overstaff, [assigned - int(demand["required_agents"]), 0])
            shortage_vars.append(shortage)
            overstaff_vars.append(overstaff)
            coverage_keys.append((demand, indexes))

        objective = request["objective"]
        model.Minimize(sum(int(objective["shortage_weight"]) * demand["priority"] * shortage for demand, shortage in zip(demands, shortage_vars)) + sum(int(objective["overstaff_weight"]) * over for over in overstaff_vars) + int(objective["assignment_weight"]) * sum(variables))
        solver = cp_model.CpSolver()
        options = request["solver_options"]
        solver.parameters.max_time_in_seconds = float(options["time_limit_seconds"])
        solver.parameters.num_search_workers = int(options["num_search_workers"])
        solver.parameters.random_seed = int(options["random_seed"])
        started = clock.perf_counter()
        status_code = solver.Solve(model)
        wall_time = clock.perf_counter() - started
        solver_status = solver.StatusName(status_code)
        if solver_status not in {"OPTIMAL", "FEASIBLE"}:
            return _empty_result(request, status="ERROR", solver_status=solver_status, diagnostics=[_diagnostic("ERROR", "SOLVER_NO_SOLUTION", f"CP-SAT kết thúc với trạng thái {solver_status}.")])

        selected = {index for index, variable in enumerate(variables) if solver.Value(variable) == 1}
        assignments = [{"employee_id": item["employee_id"], "template_id": item["template_id"], "skill_id": item["skill_id"], "start": item["start"], "end": item["end"], "breaks": item["break_items"]} for index, item in enumerate(candidates) if index in selected]
        coverage = []
        total_shortage = 0
        total_overstaff = 0
        for demand, indexes in coverage_keys:
            scheduled = sum(index in selected for index in indexes)
            required = int(demand["required_agents"])
            shortage, overstaff = max(0, required - scheduled), max(0, scheduled - required)
            total_shortage += shortage
            total_overstaff += overstaff
            coverage.append({"slot_id": demand["slot_id"], "skill_id": demand["skill_id"], "required_agents": required, "scheduled_agents": scheduled, "shortage_agents": shortage, "overstaff_agents": overstaff})

        carry_out = []
        for employee in employees:
            employee_assignments = [item for item in assignments if item["employee_id"] == employee["employee_id"]]
            last_end = max((item["end"] for item in employee_assignments), default=employee["history"]["last_shift_end"])
            carry_out.append({"employee_id": employee["employee_id"], "last_shift_end": last_end, "previous_local_days": employee["history"]["previous_local_days"]})
        objective_value = float(solver.ObjectiveValue())
        bound = float(solver.BestObjectiveBound())
        relative_gap = (abs(objective_value - bound) / max(1.0, abs(objective_value))) if solver_status == "FEASIBLE" else 0.0
        result = {"contract_version": "1.0.0", "request_id": request["request_id"], "timezone": request["timezone"], "status": "SUCCESS" if solver_status == "OPTIMAL" else "DEGRADED", "solver_status": solver_status, "solution_source": "SOLVER", "has_solution": True, "optimality_proven": solver_status == "OPTIMAL", "assignments": assignments, "coverage": coverage, "metrics": {"wall_time_seconds": round(wall_time, 6), "objective_value": objective_value, "best_objective_bound": bound, "relative_gap": relative_gap, "objective_components": {"shortage": total_shortage * int(objective["shortage_weight"]), "overstaff": total_overstaff * int(objective["overstaff_weight"]), "assignment": len(assignments) * int(objective["assignment_weight"]), "preference": 0, "fairness": 0}, "shortage_agent_slots": total_shortage, "overstaff_agent_slots": total_overstaff, "total_assignments": len(assignments), "hard_constraint_violations": 0}, "diagnostics": [], "carry_out": carry_out}
        return validate_result(result)
    except (KeyError, TypeError, ValueError, OverflowError) as exc:
        return _empty_result(request, status="INVALID_INPUT", solver_status="MODEL_INVALID", diagnostics=[_diagnostic("ERROR", "MODEL_INPUT_ERROR", str(exc))])
