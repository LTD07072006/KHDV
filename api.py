"""FastAPI Backend for Contact Center Shift Scheduling (KHDV).

Integrates:
- Excel Workbook Reader
- Erlang C Staffing Calculation
- OR-Tools CP-SAT Solver
"""

from __future__ import annotations

import io
from datetime import datetime
from typing import Any, List, Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
import pandas as pd

from erlang_c import minimum_agents
from day1_cp_sat import solve_day1, SHIFT_TEMPLATES

app = FastAPI(title="Contact Center Scheduling API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SlotInput(BaseModel):
    slot_id: str
    time_start: str
    time_end: str
    calls: int
    aht: float
    required_agents: int


class EmployeeInput(BaseModel):
    employee_id: str
    name: str
    working: bool
    allowed_shifts: List[str]


class CreateScheduleRequest(BaseModel):
    planning_date: str
    slots: List[SlotInput]
    employees: List[EmployeeInput]


def _parse_workbook_bytes(content: bytes) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    warnings = []
    try:
        excel_file = io.BytesIO(content)
        df_demand = pd.read_excel(excel_file, sheet_name="NhuCau")
        excel_file.seek(0)
        df_emp = pd.read_excel(excel_file, sheet_name="NhanVien")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Không thể đọc file Excel: {exc}")

    # Validate demand columns
    demand_cols = {c.strip() for c in df_demand.columns}
    for col in ["khung_gio", "so_cuoc_goi_du_kien", "thoi_gian_xu_ly_trung_binh_phut"]:
        if col not in demand_cols:
            raise HTTPException(status_code=400, detail=f"Sheet NhuCau thiếu cột bắt buộc: '{col}'")

    # Validate employee columns
    emp_cols = {c.strip() for c in df_emp.columns}
    for col in ["ma_nhan_vien", "ho_ten", "di_lam"]:
        if col not in emp_cols:
            raise HTTPException(status_code=400, detail=f"Sheet NhanVien thiếu cột bắt buộc: '{col}'")

    slots: list[dict[str, Any]] = []
    for idx, row in df_demand.iterrows():
        raw_time = str(row["khung_gio"]).replace("—", "–").replace("-", "–")
        parts = [p.strip() for p in raw_time.split("–")]
        if len(parts) != 2:
            warnings.append(f"Dòng {idx + 2}: Khung giờ '{raw_time}' không đúng định dạng HH:MM–HH:MM")
            continue
        start_str, end_str = parts

        try:
            calls = max(0, int(row["so_cuoc_goi_du_kien"]))
        except (ValueError, TypeError):
            calls = 0

        try:
            aht = max(0.1, float(row["thoi_gian_xu_ly_trung_binh_phut"]))
        except (ValueError, TypeError):
            aht = 5.0

        # Erlang C calculate required agents (interval = 30 mins = 1800s, SLA = 80/20)
        req_agents = minimum_agents(calls / 1800.0, aht * 60.0, sla_target=0.8, target_wait_seconds=20.0)

        slots.append({
            "slot_id": f"slot_{idx + 1:02d}",
            "time": f"{start_str}–{end_str}",
            "time_start": start_str,
            "time_end": end_str,
            "calls": calls,
            "aht": aht,
            "required": req_agents,
            "required_agents": req_agents,
        })

    employees: list[dict[str, Any]] = []
    seen_ids = set()
    for idx, row in df_emp.iterrows():
        emp_id = str(row["ma_nhan_vien"]).strip()
        if not emp_id or emp_id in seen_ids:
            continue
        seen_ids.add(emp_id)

        name = str(row["ho_ten"]).strip()
        working_val = str(row.get("di_lam", "")).strip().lower()
        working = working_val in {"có", "co", "1", "yes", "true"}

        allowed: list[str] = []
        if str(row.get("ca_ngay", "")).strip().lower() in {"có", "co", "1", "yes", "true"}:
            allowed.append("ca_ngay")
        if str(row.get("ca_dem", "")).strip().lower() in {"có", "co", "1", "yes", "true"}:
            allowed.append("ca_dem")

        # Fallback shift and break string for display
        primary_shift = allowed[0] if allowed else "ca_ngay"
        template = SHIFT_TEMPLATES.get(primary_shift)
        shift_label = template.label if template else "Chưa chọn ca"
        break_label = f"{template.break_start.strftime('%H:%M')}–{template.break_end.strftime('%H:%M')}" if template else "—"

        employees.append({
            "id": emp_id,
            "employee_id": emp_id,
            "name": name,
            "working": working,
            "allowedShifts": allowed,
            "allowed_shifts": allowed,
            "shift": shift_label,
            "breakTime": break_label,
            "status": "Sẵn sàng" if working and allowed else ("Chưa chọn ca" if working else "Nghỉ"),
        })

    return slots, employees, warnings


@app.get("/health")
def health():
    return {
        "status": "ok",
        "solver": "ortools",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }


@app.post("/api/preview-workbook")
async def preview_workbook(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="File tải lên phải có định dạng Excel .xlsx")

    content = await file.read()
    slots, employees, warnings = _parse_workbook_bytes(content)

    total_calls = sum(s["calls"] for s in slots)
    max_required = max((s["required"] for s in slots), default=0)

    return {
        "filename": file.filename,
        "summary": {
            "total_slots": len(slots),
            "total_calls": total_calls,
            "max_required": max_required,
            "total_employees": len(employees),
            "working_employees": sum(1 for e in employees if e["working"]),
        },
        "demand": slots,
        "employees": employees,
        "warnings": warnings,
    }


@app.post("/api/create-schedule")
async def create_schedule(payload: CreateScheduleRequest):
    request_data = {
        "planning_date": payload.planning_date,
        "slots": [
            {
                "slot_id": s.slot_id,
                "time_start": s.time_start,
                "time_end": s.time_end,
                "required_agents": s.required_agents,
            }
            for s in payload.slots
        ],
        "employees": [
            {
                "employee_id": e.employee_id,
                "name": e.name,
                "working": e.working,
                "allowed_shifts": e.allowed_shifts,
            }
            for e in payload.employees
        ],
    }

    try:
        result = solve_day1(request_data, time_limit_seconds=10.0, workers=4)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Lỗi khi giải bài toán CP-SAT: {exc}")

    return result
