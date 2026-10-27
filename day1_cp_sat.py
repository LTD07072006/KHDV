"""CP-SAT MVP cho luồng một ngày, một nhóm Hỗ trợ chung.

Input là dữ liệu nghiệp vụ đơn giản, chưa phải SchedulingRequest đầy đủ:
`planning_date`, `slots` và `employees`. Module này là bước chạy ngày 1 để
chứng minh mô hình chọn ca, coverage và cảnh báo thiếu người.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Any, Mapping, Sequence

from ortools.sat.python import cp_model


SHORTAGE_WEIGHT = 10_000
OVERSTAFF_WEIGHT = 10
ASSIGNMENT_WEIGHT = 1


@dataclass(frozen=True)
class ShiftTemplate:
    template_id: str
    label: str
    start: time
    end: time
    break_start: time
    break_end: time


SHIFT_TEMPLATES: dict[str, ShiftTemplate] = {
    "ca_ngay": ShiftTemplate("ca_ngay", "Ca ngày", time(8, 0), time(20, 0), time(12, 0), time(13, 0)),
    "ca_dem": ShiftTemplate("ca_dem", "Ca đêm", time(20, 0), time(8, 0), time(0, 0), time(1, 0)),
}


def _clock(value: str) -> time:
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(value.strip(), fmt).time()
        except ValueError:
            continue
    raise ValueError(f"Giờ không hợp lệ: {value!r}; cần dạng HH:MM")


def _interval(value: Mapping[str, Any]) -> tuple[time, time]:
    start = _clock(str(value["time_start"]))
    end = _clock(str(value["time_end"]))
    if end <= start:
        raise ValueError("Slot phải có giờ kết thúc sau giờ bắt đầu")
    if datetime.combine(datetime.min, end) - datetime.combine(datetime.min, start) != timedelta(minutes=30):
        raise ValueError("MVP chỉ nhận slot dài 30 phút")
    return start, end


def _as_minutes(value: time) -> int:
    return value.hour * 60 + value.minute


def _covers(template: ShiftTemplate, slot_start: time, slot_end: time) -> bool:
    start, end = _as_minutes(slot_start), _as_minutes(slot_end)
    shift_start, shift_end = _as_minutes(template.start), _as_minutes(template.end)
    break_start, break_end = _as_minutes(template.break_start), _as_minutes(template.break_end)
    if shift_end <= shift_start:
        shift_end += 24 * 60
        if start < shift_start:
            start += 24 * 60
        if end <= shift_start:
            end += 24 * 60
        if break_start < shift_start:
            break_start += 24 * 60
        if break_end <= shift_start:
            break_end += 24 * 60
    return (
        shift_start <= start
        and end <= shift_end
        and not (break_start <= start and end <= break_end)
    )


def _validate_request(request: Mapping[str, Any]) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    planning_date = str(request.get("planning_date", "")).strip()
    if not planning_date:
        raise ValueError("Thiếu planning_date")
    try:
        datetime.strptime(planning_date, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError("planning_date phải có dạng YYYY-MM-DD") from exc

    slots = request.get("slots")
    employees = request.get("employees")
    if not isinstance(slots, Sequence) or isinstance(slots, (str, bytes)) or not slots:
        raise ValueError("Cần ít nhất một slot")
    if not isinstance(employees, Sequence) or isinstance(employees, (str, bytes)) or not employees:
        raise ValueError("Cần ít nhất một nhân viên")

    normalized_slots: list[dict[str, Any]] = []
    seen_slots: set[tuple[str, str]] = set()
    for index, raw in enumerate(slots):
        if not isinstance(raw, Mapping):
            raise ValueError(f"Slot {index + 1} không hợp lệ")
        start, end = _interval(raw)
        key = (str(raw["time_start"]), str(raw["time_end"]))
        if key in seen_slots:
            raise ValueError(f"Slot bị trùng: {key[0]}–{key[1]}")
        seen_slots.add(key)
        required = int(raw.get("required_agents", 0))
        if required < 0:
            raise ValueError("required_agents không được âm")
        normalized_slots.append({"slot_id": str(raw.get("slot_id", f"slot_{index + 1:02d}")), "start": start, "end": end, "required_agents": required})

    seen_employees: set[str] = set()
    normalized_employees: list[dict[str, Any]] = []
    for raw in employees:
        if not isinstance(raw, Mapping):
            raise ValueError("Mỗi nhân viên phải là object")
        employee_id = str(raw.get("employee_id", "")).strip()
        if not employee_id or employee_id in seen_employees:
            raise ValueError(f"Mã nhân viên trống hoặc bị trùng: {employee_id or '<trống>'}")
        seen_employees.add(employee_id)
        allowed = [str(item) for item in raw.get("allowed_shifts", [])]
        unknown = sorted(set(allowed) - set(SHIFT_TEMPLATES))
        if unknown:
            raise ValueError(f"Ca không hợp lệ của {employee_id}: {', '.join(unknown)}")
        working = bool(raw.get("working", True))
        if working and not allowed:
            raise ValueError(f"{employee_id} đi làm nhưng chưa chọn ca")
        normalized_employees.append({"employee_id": employee_id, "name": str(raw.get("name", employee_id)), "working": working, "allowed_shifts": allowed})
    return planning_date, normalized_slots, normalized_employees


def solve_day1(request: Mapping[str, Any], *, time_limit_seconds: float = 10.0, workers: int = 4) -> dict[str, Any]:
    """Giải bài toán CP-SAT MVP và trả result dễ đọc cho UI/demo."""
    planning_date, slots, employees = _validate_request(request)
    model = cp_model.CpModel()
    assignment: dict[tuple[int, str], Any] = {}

    for employee_index, employee in enumerate(employees):
        variables = []
        for template_id, template in SHIFT_TEMPLATES.items():
            variable = model.NewBoolVar(f"assign_{employee_index}_{template_id}")
            assignment[(employee_index, template_id)] = variable
            variables.append(variable)
            if not employee["working"] or template_id not in employee["allowed_shifts"]:
                model.Add(variable == 0)
        model.Add(sum(variables) <= 1)

    shortage_vars: list[Any] = []
    overstaff_vars: list[Any] = []
    coverage_keys: list[list[tuple[int, str]]] = []
    for slot_index, slot in enumerate(slots):
        keys = [
            (employee_index, template_id)
            for employee_index, employee in enumerate(employees)
            for template_id, template in SHIFT_TEMPLATES.items()
            if template_id in employee["allowed_shifts"] and employee["working"] and _covers(template, slot["start"], slot["end"])
        ]
        assigned = sum(assignment[key] for key in keys) if keys else 0
        shortage = model.NewIntVar(0, slot["required_agents"], f"shortage_{slot_index}")
        overstaff = model.NewIntVar(0, len(employees), f"overstaff_{slot_index}")
        model.Add(assigned + shortage - overstaff == slot["required_agents"])
        shortage_vars.append(shortage)
        overstaff_vars.append(overstaff)
        coverage_keys.append(keys)

    model.Minimize(
        SHORTAGE_WEIGHT * sum(shortage_vars)
        + OVERSTAFF_WEIGHT * sum(overstaff_vars)
        + ASSIGNMENT_WEIGHT * sum(assignment.values())
    )
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit_seconds)
    solver.parameters.num_search_workers = max(1, int(workers))
    solver.parameters.random_seed = 42
    status_code = solver.Solve(model)
    status_name = solver.StatusName(status_code)
    if status_name not in {"OPTIMAL", "FEASIBLE"}:
        return {"status": status_name, "has_solution": False, "assignments": [], "coverage": [], "diagnostics": ["CP-SAT không tìm được nghiệm."]}

    selected = {key for key, variable in assignment.items() if solver.Value(variable) == 1}
    assignments: list[dict[str, Any]] = []
    for employee_index, template_id in sorted(selected):
        employee = employees[employee_index]
        template = SHIFT_TEMPLATES[template_id]
        assignments.append({"employee_id": employee["employee_id"], "employee_name": employee["name"], "template_id": template_id, "shift": template.label, "shift_start": template.start.strftime("%H:%M"), "shift_end": template.end.strftime("%H:%M"), "break_start": template.break_start.strftime("%H:%M"), "break_end": template.break_end.strftime("%H:%M"), "date": planning_date})

    coverage: list[dict[str, Any]] = []
    total_shortage = total_overstaff = 0
    for slot, keys in zip(slots, coverage_keys, strict=True):
        scheduled = sum(1 for key in keys if key in selected)
        shortage = max(0, slot["required_agents"] - scheduled)
        overstaff = max(0, scheduled - slot["required_agents"])
        total_shortage += shortage
        total_overstaff += overstaff
        coverage.append({"slot_id": slot["slot_id"], "time_start": slot["start"].strftime("%H:%M"), "time_end": slot["end"].strftime("%H:%M"), "required_agents": slot["required_agents"], "scheduled_agents": scheduled, "shortage_agents": shortage, "overstaff_agents": overstaff})

    return {"status": status_name, "has_solution": True, "solution_source": "CP-SAT", "planning_date": planning_date, "assignments": assignments, "coverage": coverage, "metrics": {"objective_value": solver.ObjectiveValue(), "total_shortage": total_shortage, "total_overstaff": total_overstaff, "assigned_shifts": len(assignments)}, "diagnostics": []}

