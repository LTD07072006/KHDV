"""Automated test runner for the 4 official fixtures (Day 8).

Verifies:
1. 01_normal.xlsx: Optimal solution, 100% coverage, 0 shortage.
2. 02_peak_demand.xlsx: Optimal solution, soft shortage on peak slots.
3. 03_understaffed.xlsx: Optimal solution with few staff, no crash.
4. 04_invalid_data.xlsx: Catches validation errors (missing shift/duplicate id).
"""

import unittest
from pathlib import Path
from api import _parse_workbook_bytes
from day1_cp_sat import solve_day1

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


class TestFixtures(unittest.TestCase):
    def test_01_normal(self):
        content = (FIXTURES_DIR / "01_normal.xlsx").read_bytes()
        slots, employees, warnings = _parse_workbook_bytes(content)
        self.assertEqual(len(slots), 24)
        self.assertEqual(len(employees), 6)

        req = {
            "planning_date": "2026-11-02",
            "slots": [{"slot_id": s["slot_id"], "time_start": s["time_start"], "time_end": s["time_end"], "required_agents": s["required_agents"]} for s in slots],
            "employees": [{"employee_id": e["employee_id"], "name": e["name"], "working": e["working"], "allowed_shifts": e["allowed_shifts"]} for e in employees],
        }
        res = solve_day1(req)
        self.assertIn(res.get("status"), {"OPTIMAL", "FEASIBLE"})
        self.assertTrue(res.get("has_solution"))
        self.assertEqual(res["metrics"]["total_shortage"], 0, "01_normal phải đạt 100% độ phủ, 0 shortage")

    def test_02_peak_demand(self):
        content = (FIXTURES_DIR / "02_peak_demand.xlsx").read_bytes()
        slots, employees, warnings = _parse_workbook_bytes(content)
        self.assertEqual(len(slots), 24)

        req = {
            "planning_date": "2026-11-02",
            "slots": [{"slot_id": s["slot_id"], "time_start": s["time_start"], "time_end": s["time_end"], "required_agents": s["required_agents"]} for s in slots],
            "employees": [{"employee_id": e["employee_id"], "name": e["name"], "working": e["working"], "allowed_shifts": e["allowed_shifts"]} for e in employees],
        }
        res = solve_day1(req)
        self.assertIn(res.get("status"), {"OPTIMAL", "FEASIBLE"})
        self.assertTrue(res.get("has_solution"))
        self.assertGreater(res["metrics"]["total_shortage"], 0, "02_peak_demand phải có soft shortage ở giờ cao điểm")

    def test_03_understaffed(self):
        content = (FIXTURES_DIR / "03_understaffed.xlsx").read_bytes()
        slots, employees, warnings = _parse_workbook_bytes(content)
        req = {
            "planning_date": "2026-11-02",
            "slots": [{"slot_id": s["slot_id"], "time_start": s["time_start"], "time_end": s["time_end"], "required_agents": s["required_agents"]} for s in slots],
            "employees": [{"employee_id": e["employee_id"], "name": e["name"], "working": e["working"], "allowed_shifts": e["allowed_shifts"]} for e in employees],
        }
        res = solve_day1(req)
        self.assertIn(res.get("status"), {"OPTIMAL", "FEASIBLE"})
        self.assertTrue(res.get("has_solution"), "Hệ thống không được crash khi thiếu nhân viên")

    def test_04_invalid_data(self):
        content = (FIXTURES_DIR / "04_invalid_data.xlsx").read_bytes()
        slots, employees, warnings = _parse_workbook_bytes(content)
        # NV002 is working without shift selected
        req = {
            "planning_date": "2026-11-02",
            "slots": [{"slot_id": s["slot_id"], "time_start": s["time_start"], "time_end": s["time_end"], "required_agents": s["required_agents"]} for s in slots],
            "employees": [{"employee_id": e["employee_id"], "name": e["name"], "working": e["working"], "allowed_shifts": e["allowed_shifts"]} for e in employees],
        }
        with self.assertRaises(ValueError):
            solve_day1(req)


if __name__ == "__main__":
    unittest.main()
