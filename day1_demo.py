"""Chạy hai fixture ngày 1: đủ người và thiếu người."""

import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from day1_cp_sat import solve_day1


def request(required: int, employees: int) -> dict:
    return {
        "planning_date": "2026-11-02",
        "slots": [{"slot_id": f"slot_{hour:02d}", "time_start": f"{hour:02d}:00", "time_end": f"{hour:02d}:30", "required_agents": required} for hour in range(8, 12)],
        "employees": [{"employee_id": f"NV{i:03d}", "name": f"Nhân viên {i}", "working": True, "allowed_shifts": ["ca_ngay"]} for i in range(1, employees + 1)],
    }


for label, fixture in (("ĐỦ NGƯỜI", request(2, 3)), ("THIẾU NGƯỜI", request(5, 3))):
    result = solve_day1(fixture)
    print(f"\n{label}")
    print(f"status={result['status']} assignments={len(result['assignments'])} shortage={result['metrics']['total_shortage']}")
    for row in result["coverage"]:
        print(f"  {row['time_start']}–{row['time_end']}: cần {row['required_agents']}, đã xếp {row['scheduled_agents']}, thiếu {row['shortage_agents']}")

