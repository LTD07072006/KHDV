"""Legacy Streamlit dashboard retained for historical reference only.

The active MVP boundary is now ``SchedulingRequest v1.0.0`` →
``SchedulingResult v1.0.0`` through :mod:`workbook_adapter` and
:mod:`scheduling_solver`. This file still contains the original prototype UI,
which reads the retired ``intervals``/``roster`` shape; do not use it as the
application entry point until it is migrated in the backend/API step.

Run only when inspecting the legacy prototype:
    streamlit run app.py

The sidebar sliders rebuild Module 1 from a CSV when one is available, and
the dashboard can optionally invoke the CP-SAT solver.  Without input files it
uses the checked-in JSON contracts, which makes UI development possible before
the solver service is deployed.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.express as px
import streamlit as st


ROOT = Path(__file__).resolve().parent
DEFAULT_REQUIREMENTS = ROOT / "staffing_requirements.json"
DEFAULT_ROSTER = ROOT / "optimized_roster.json"
DEFAULT_CALL_LOG = ROOT / "data" / "call_logs.csv"
DEFAULT_EMPLOYEES = ROOT / "employees.json"


def _read_json(path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return fallback
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        st.warning(f"Không thể đọc {path.name}: {exc}")
        return fallback
    return payload if isinstance(payload, dict) else fallback


def _empty_requirements() -> dict[str, Any]:
    return {
        "schema_version": "1.0",
        "date": datetime.now().date().isoformat(),
        "sla_target": 0.80,
        "wait_time_target_seconds": 20.0,
        "intervals": [],
    }


def _empty_roster() -> dict[str, Any]:
    return {"schema_version": "1.0", "status": "NO_DATA", "total_penalty_score": 0, "roster": [], "coverage": []}


@st.cache_data(show_spinner=False)
def _build_requirements(csv_path: str, sla: float, wait_seconds: float) -> dict[str, Any]:
    from erlang_c import process_csv

    return process_csv(
        csv_path,
        sla_target=sla,
        target_wait_seconds=wait_seconds,
        output_date=datetime.now().date().isoformat(),
    )


def _run_solver(requirements: dict[str, Any], employees_path: Path) -> dict[str, Any]:
    """Mock the solver service boundary by calling the CP-SAT module locally."""
    if not employees_path.exists():
        return _empty_roster()
    try:
        from solver import load_employees, solve_contract
        return solve_contract(requirements, load_employees(employees_path), time_limit_seconds=10.0)
    except (OSError, RuntimeError, ValueError) as exc:
        st.warning(f"Không thể gọi solver: {exc}")
        return _empty_roster()


def _coverage_frame(requirements: dict[str, Any], roster: dict[str, Any]) -> pd.DataFrame:
    coverage = roster.get("coverage", [])
    if coverage:
        frame = pd.DataFrame(coverage)
        if {"time_start", "required_agents", "scheduled_agents"}.issubset(frame.columns):
            return frame
    intervals = pd.DataFrame(requirements.get("intervals", []))
    if intervals.empty:
        return pd.DataFrame(columns=["time_start", "required_agents", "scheduled_agents"])
    roster_rows = roster.get("roster", [])
    planning_date = str(requirements.get("date") or datetime.now().date().isoformat())
    scheduled_values: list[int] = []
    for interval in intervals.to_dict("records"):
        interval_date = str(interval.get("date") or planning_date)
        interval_start = _as_datetime(str(interval["time_start"]), interval_date)
        interval_end = _as_datetime(str(interval["time_end"]), interval_date)
        if interval_end <= interval_start:
            interval_end += timedelta(days=1)
        scheduled = 0
        for assignment in roster_rows:
            if str(assignment.get("date") or planning_date) != interval_date:
                continue
            shift_start = _as_datetime(str(assignment["shift_start"]), interval_date)
            shift_end = _as_datetime(str(assignment["shift_end"]), interval_date)
            break_start = _as_datetime(str(assignment.get("break_start", "00:00")), interval_date)
            break_end = _as_datetime(str(assignment.get("break_end", "00:00")), interval_date)
            first_segment = shift_start < interval_end and interval_start < break_start
            second_segment = break_end < interval_end and interval_start < shift_end
            scheduled += int(first_segment or second_segment)
        scheduled_values.append(scheduled)
    intervals["scheduled_agents"] = scheduled_values
    return intervals


def _plot_coverage(requirements: dict[str, Any], roster: dict[str, Any]):
    frame = _coverage_frame(requirements, roster)
    if frame.empty:
        return None
    if "date" in frame and frame["date"].nunique() > 1:
        frame["interval_label"] = frame["date"].astype(str) + " " + frame["time_start"].astype(str)
    else:
        frame["interval_label"] = frame["time_start"].astype(str)
    long_frame = frame.melt(
        id_vars=["interval_label"],
        value_vars=["required_agents", "scheduled_agents"],
        var_name="metric",
        value_name="agents",
    )
    labels = {"required_agents": "Yêu cầu", "scheduled_agents": "Đã xếp"}
    long_frame["metric"] = long_frame["metric"].map(labels).fillna(long_frame["metric"])
    return px.line(
        long_frame,
        x="interval_label",
        y="agents",
        color="metric",
        markers=True,
        labels={"interval_label": "Bắt đầu khung 30 phút", "agents": "Số nhân viên", "metric": ""},
        title="Nhân viên yêu cầu và nhân viên đã xếp",
    )


def _as_datetime(value: str, date_text: str) -> datetime:
    if "T" in str(value):
        return datetime.fromisoformat(str(value))
    return datetime.fromisoformat(f"{date_text}T{value}")


def _plot_gantt(roster: list[dict[str, Any]]):
    rows: list[dict[str, Any]] = []
    for assignment in roster:
        day = str(assignment.get("date") or datetime.now().date().isoformat())
        start = _as_datetime(str(assignment["shift_start"]), day)
        end = _as_datetime(str(assignment["shift_end"]), day)
        break_start = assignment.get("break_start")
        break_end = assignment.get("break_end")
        rows.append(
            {
                "employee_id": assignment["employee_id"],
                "Task": "Làm việc",
                "Start": start,
                "Finish": _as_datetime(str(break_start), day) if break_start else end,
                "resource": assignment["employee_id"],
            }
        )
        if break_start and break_end:
            rows.append(
                {
                    "employee_id": assignment["employee_id"],
                    "Task": "Làm việc",
                    "Start": _as_datetime(str(break_end), day),
                    "Finish": end,
                    "resource": assignment["employee_id"],
                }
            )
            rows.append(
                {
                    "employee_id": assignment["employee_id"],
                    "Task": "Nghỉ",
                    "Start": _as_datetime(str(assignment["break_start"]), day),
                    "Finish": _as_datetime(str(assignment["break_end"]), day),
                    "resource": assignment["employee_id"],
                }
            )
    if not rows:
        return None
    return px.timeline(
        pd.DataFrame(rows),
        x_start="Start",
        x_end="Finish",
        y="employee_id",
        color="Task",
        hover_data=["resource"],
        color_discrete_map={"Làm việc": "#2563eb", "Nghỉ": "#f59e0b"},
        title="Gantt ca làm và giờ nghỉ",
    )


def main() -> None:
    st.set_page_config(page_title="Call Centre Scheduler", layout="wide")
    st.title("Lập lịch ca trung tâm chăm sóc khách hàng")
    st.caption("Erlang C + CP-SAT · dữ liệu lịch sử trung bình theo khung 30 phút")

    with st.sidebar:
        st.header("Tham số SLA")
        sla_percent = st.slider("SLA (%)", 50, 99, 80, 1)
        wait_seconds = st.slider("Mục tiêu chờ (giây)", 5, 120, 20, 5)
        use_solver = st.checkbox("Chạy CP-SAT khi có employees.json", value=True)
        uploaded_csv = st.file_uploader("CSV log cuộc gọi (tuỳ chọn)", type=["csv"])

    sla = sla_percent / 100.0
    if uploaded_csv is not None:
        from erlang_c import build_staffing_requirements
        requirements = build_staffing_requirements(
            pd.read_csv(uploaded_csv),
            sla_target=sla,
            target_wait_seconds=float(wait_seconds),
            output_date=datetime.now().date().isoformat(),
        )
    elif DEFAULT_CALL_LOG.exists():
        requirements = _build_requirements(str(DEFAULT_CALL_LOG), sla, float(wait_seconds))
    else:
        requirements = _read_json(DEFAULT_REQUIREMENTS, _empty_requirements())
        requirements["sla_target"] = sla
        requirements["wait_time_target_seconds"] = float(wait_seconds)

    if use_solver and DEFAULT_EMPLOYEES.exists():
        roster = _run_solver(requirements, DEFAULT_EMPLOYEES)
    else:
        roster = _read_json(DEFAULT_ROSTER, _empty_roster())

    st.metric("Trạng thái solver", roster.get("status", "NO_DATA"))
    st.metric("Tổng điểm phạt", roster.get("total_penalty_score", "—"))
    tab_coverage, tab_gantt = st.tabs(["Nhu cầu nhân sự", "Gantt ca làm"])
    with tab_coverage:
        chart = _plot_coverage(requirements, roster)
        if chart is None:
            st.info("Chưa có dữ liệu staffing hoặc roster.")
        else:
            st.plotly_chart(chart, use_container_width=True)
            st.dataframe(_coverage_frame(requirements, roster), use_container_width=True, hide_index=True)
    with tab_gantt:
        chart = _plot_gantt(roster.get("roster", []))
        if chart is None:
            st.info("Chưa có roster để hiển thị.")
        else:
            chart.update_yaxes(autorange="reversed")
            st.plotly_chart(chart, use_container_width=True)
            st.dataframe(pd.DataFrame(roster["roster"]), use_container_width=True, hide_index=True)


if __name__ == "__main__":
    main()
