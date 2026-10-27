"""Convert the non-technical Excel input into ``SchedulingRequest v1.0.0``.

The adapter deliberately owns the translation boundary.  The UI/workbook only
contains Vietnamese labels and simple values; the solver receives the stable
technical contract and never has to read Excel.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from pathlib import Path
import re
from typing import Any, Mapping

import pandas as pd

from erlang_c import minimum_agents, service_level


DEMAND_COLUMNS = {
    "khung_gio",
    "so_cuoc_goi_du_kien",
    "thoi_gian_xu_ly_trung_binh_phut",
}
EMPLOYEE_COLUMNS = {
    "ma_nhan_vien",
    "ho_ten",
    "di_lam",
    "ca_ngay",
    "ca_dem",
}
# Shift times use minutes from the planning date midnight so the night shift
# can end on the following day without producing an invalid 24:00 timestamp.
SHIFT_TEMPLATES = {
    "ca_ngay": ("day_0800", 8 * 60, 20 * 60, 12 * 60, 13 * 60),
    "ca_dem": ("night_2000", 20 * 60, 32 * 60, 24 * 60, 25 * 60),
}
BOOL_TRUE = {"có", "co", "yes", "y", "1", "true"}
BOOL_FALSE = {"không", "khong", "no", "n", "0", "false"}


def _text(value: Any) -> str:
    return "" if value is None or (isinstance(value, float) and pd.isna(value)) else str(value).strip()


def _boolean(value: Any, field: str, row_number: int) -> bool:
    normalized = _text(value).casefold()
    if normalized in BOOL_TRUE:
        return True
    if normalized in BOOL_FALSE:
        return False
    raise ValueError(f"Dòng {row_number}: cột “{field}” chỉ nhận Có hoặc Không.")


def _clock(value: str) -> int:
    match = re.fullmatch(r"(\d{1,2}):(\d{2})", value.strip())
    if not match:
        raise ValueError(f"Khung giờ “{value}” không đúng dạng HH:MM.")
    hour, minute = int(match.group(1)), int(match.group(2))
    if hour > 23 or minute > 59:
        raise ValueError(f"Khung giờ “{value}” không hợp lệ.")
    return hour * 60 + minute


def _interval(value: Any) -> tuple[int, int]:
    raw = _text(value).replace("—", "–").replace("-", "–")
    parts = [part.strip() for part in raw.split("–")]
    if len(parts) != 2:
        raise ValueError(f"Khung giờ “{raw}” phải có dạng HH:MM–HH:MM.")
    start, end = _clock(parts[0]), _clock(parts[1])
    if end <= start or end - start != 30:
        raise ValueError(f"Khung giờ “{raw}” phải dài đúng 30 phút trong MVP.")
    return start, end


def _stamp(day: date, minutes: int) -> str:
    moment = datetime.combine(day, time.min) + timedelta(minutes=minutes)
    return moment.strftime("%Y-%m-%dT%H:%M:00+07:00")


def _date(value: date | str) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return date.fromisoformat(str(value))


def _required_columns(frame: pd.DataFrame, expected: set[str], sheet: str) -> None:
    missing = sorted(expected.difference(frame.columns))
    if missing:
        raise ValueError(f"Trang {sheet} thiếu cột bắt buộc: {', '.join(missing)}.")


def build_request_from_frames(
    demand_frame: pd.DataFrame,
    employee_frame: pd.DataFrame,
    planning_date: date | str,
    *,
    common_aht_minutes: float | None = None,
    service_target: float = 0.80,
    answer_within_seconds: float = 20.0,
    request_id: str | None = None,
) -> tuple[dict[str, Any], list[str]]:
    """Return ``(request, warnings)`` from normalized workbook-like frames."""
    day = _date(planning_date)
    if not 0 < service_target <= 1:
        raise ValueError("Mức phục vụ phải nằm trong khoảng lớn hơn 0 đến 1.")
    _required_columns(demand_frame, DEMAND_COLUMNS, "NhuCau")
    _required_columns(employee_frame, EMPLOYEE_COLUMNS, "NhanVien")
    if demand_frame.empty:
        raise ValueError("Trang NhuCau chưa có dòng dữ liệu.")
    if employee_frame.empty:
        raise ValueError("Trang NhanVien chưa có dòng dữ liệu.")

    warnings: list[str] = []
    intervals: list[tuple[int, int, float, float]] = []
    seen: set[tuple[int, int]] = set()
    for index, row in demand_frame.iterrows():
        row_number = int(index) + 2
        start, end = _interval(row["khung_gio"])
        if start < 8 * 60 or end > 20 * 60:
            raise ValueError(f"Dòng {row_number}: khung giờ nằm ngoài giờ hoạt động 08:00–20:00.")
        if (start, end) in seen:
            raise ValueError(f"Dòng {row_number}: khung giờ bị trùng.")
        seen.add((start, end))
        try:
            calls = float(row["so_cuoc_goi_du_kien"])
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Dòng {row_number}: số cuộc gọi phải là số không âm.") from exc
        if calls < 0:
            raise ValueError(f"Dòng {row_number}: số cuộc gọi không được âm.")
        raw_aht = row["thoi_gian_xu_ly_trung_binh_phut"]
        aht = common_aht_minutes if _text(raw_aht) == "" else float(raw_aht)
        if aht is None or (calls > 0 and aht <= 0):
            raise ValueError(f"Dòng {row_number}: cần AHT dương khi có cuộc gọi.")
        intervals.append((start, end, calls, float(aht)))

    intervals.sort()
    for previous, current in zip(intervals, intervals[1:]):
        if current[0] > previous[1]:
            warnings.append(
                f"Khoảng {previous[1] // 60:02d}:{previous[1] % 60:02d}–{current[0] // 60:02d}:{current[0] % 60:02d} chưa có dữ liệu nhu cầu."
            )
    slots: list[dict[str, str]] = []
    demand: list[dict[str, Any]] = []
    for start, end, calls, aht_minutes in intervals:
        slot_count = (end - start) // 30
        calls_per_slot = calls / slot_count
        for slot_start in range(start, end, 30):
            slot_end = slot_start + 30
            slot_id = f"slot_{len(slots) + 1:02d}"
            slots.append({"slot_id": slot_id, "start": _stamp(day, slot_start), "end": _stamp(day, slot_end)})
            aht_seconds = aht_minutes * 60
            offered_load = calls_per_slot / 1800 * aht_seconds
            required = minimum_agents(calls_per_slot / 1800, aht_seconds, service_target, answer_within_seconds)
            demand.append({
                "slot_id": slot_id,
                "skill_id": "general_support",
                "required_agents": required,
                "priority": 1,
                "forecast": {"expected_calls": calls_per_slot, "aht_seconds": aht_seconds, "method": "manager_expected_demand", "quantile": None},
                "erlang": {
                    "service_level": service_target,
                    "answer_within_seconds": answer_within_seconds,
                    "max_occupancy": 0.85,
                    "shrinkage_excluding_planned_breaks": 0.0,
                    "offered_load_erlangs": round(offered_load, 6),
                    "net_agents": required,
                },
            })

    employees: list[dict[str, Any]] = []
    selected_template_keys: set[str] = set()
    for index, row in employee_frame.iterrows():
        row_number = int(index) + 2
        employee_id, label = _text(row["ma_nhan_vien"]), _text(row["ho_ten"])
        if not employee_id or not label:
            raise ValueError(f"Dòng {row_number}: mã nhân viên và họ tên không được trống.")
        if any(item["employee_id"] == employee_id for item in employees):
            raise ValueError(f"Mã {employee_id} xuất hiện nhiều lần.")
        working = _boolean(row["di_lam"], "di_lam", row_number)
        selected = [key for key in SHIFT_TEMPLATES if _boolean(row[key], key, row_number)]
        if working and not selected:
            raise ValueError(f"{employee_id} đang đi làm nhưng chưa chọn ca nào.")
        if not working:
            continue
        selected_template_keys.update(selected)
        availability = []
        preferences = []
        for key in selected:
            template_id, start, end, _, _ = SHIFT_TEMPLATES[key]
            availability.append({"start": _stamp(day, start), "end": _stamp(day, end)})
            preferences.append({"template_id": template_id, "penalty": 0})
        history = [{"date": (day - timedelta(days=offset)).isoformat(), "worked": False} for offset in range(6, 0, -1)]
        employees.append({
            "employee_id": employee_id,
            "label": label,
            "skill_ids": ["general_support"],
            "availability": availability,
            "max_scheduled_minutes_in_horizon": 480,
            "history": {"last_shift_end": None, "previous_local_days": history},
            "preferences": preferences,
        })
    if not employees:
        raise ValueError("Không có nhân viên nào đi làm.")

    templates = []
    for key in SHIFT_TEMPLATES:
        if key not in selected_template_keys:
            continue
        template_id, start, end, break_start, break_end = SHIFT_TEMPLATES[key]
        templates.append({
            "template_id": template_id,
            "start": _stamp(day, start),
            "end": _stamp(day, end),
            "breaks": [{"start": _stamp(day, break_start), "end": _stamp(day, break_end)}],
            "allowed_skill_ids": ["general_support"],
        })

    request = {
        "contract_version": "1.0.0",
        "request_id": request_id or f"req_{day.isoformat()}",
        "timezone": "Asia/Ho_Chi_Minh",
        "horizon": {"start": _stamp(day, 8 * 60), "end": _stamp(day, 20 * 60), "slot_minutes": 30},
        "skills": [{"skill_id": "general_support", "label": "Hỗ trợ chung"}],
        "slots": slots,
        "demand": demand,
        "employees": employees,
        "shift_templates": templates,
        "rules": {"shift_span_minutes": 480, "break_minutes": 60, "min_rest_minutes": 720, "max_consecutive_workdays": 5, "max_shifts_per_local_day": 1, "allow_unassigned": True},
        "objective": {"mode": "weighted_sum", "shortage_weight": 100, "overstaff_weight": 10, "assignment_weight": 1, "preference_weight": 0, "fairness_weight": 0},
        "solver_options": {"time_limit_seconds": 30, "num_search_workers": 8, "random_seed": 42, "return_baseline_on_timeout": True},
    }
    return request, warnings


def build_request_from_workbook(path: str | Path, planning_date: date | str, **kwargs: Any) -> tuple[dict[str, Any], list[str]]:
    """Read the three-sheet MVP workbook and delegate to the frame adapter."""
    try:
        demand = pd.read_excel(path, sheet_name="NhuCau")
        employees = pd.read_excel(path, sheet_name="NhanVien")
    except ImportError as exc:
        raise RuntimeError("Cần cài bộ đọc Excel (openpyxl) để nạp file .xlsx.") from exc
    except ValueError as exc:
        raise ValueError("Workbook phải có đúng hai sheet dữ liệu: NhuCau và NhanVien.") from exc
    return build_request_from_frames(demand, employees, planning_date, **kwargs)
