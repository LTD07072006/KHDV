import unittest

from day1_cp_sat import solve_day1


def fixture(required: int, employees: int) -> dict:
    return {
        "planning_date": "2026-11-02",
        "slots": [{"time_start": "08:00", "time_end": "08:30", "required_agents": required}],
        "employees": [{"employee_id": f"NV{i}", "working": True, "allowed_shifts": ["ca_ngay"]} for i in range(employees)],
    }


class Day1CpSatTests(unittest.TestCase):
    def test_full_coverage_when_capacity_is_sufficient(self):
        result = solve_day1(fixture(2, 3))
        self.assertTrue(result["has_solution"])
        self.assertEqual(result["coverage"][0]["shortage_agents"], 0)

    def test_shortage_is_soft_when_capacity_is_insufficient(self):
        result = solve_day1(fixture(5, 3))
        self.assertTrue(result["has_solution"])
        self.assertEqual(result["coverage"][0]["scheduled_agents"], 3)
        self.assertEqual(result["coverage"][0]["shortage_agents"], 2)

    def test_one_shift_per_employee(self):
        result = solve_day1({**fixture(1, 1), "employees": [{"employee_id": "NV1", "working": True, "allowed_shifts": ["ca_ngay", "ca_dem"]}]})
        self.assertEqual(len(result["assignments"]), 1)

    def test_night_shift_covers_after_midnight_but_not_its_break(self):
        result = solve_day1({
            "planning_date": "2026-11-02",
            "slots": [
                {"time_start": "23:00", "time_end": "23:30", "required_agents": 1},
                {"time_start": "00:00", "time_end": "00:30", "required_agents": 1},
                {"time_start": "00:30", "time_end": "01:00", "required_agents": 1},
            ],
            "employees": [{"employee_id": "NV1", "working": True, "allowed_shifts": ["ca_dem"]}],
        })
        self.assertEqual(result["coverage"][0]["scheduled_agents"], 1)
        self.assertEqual(result["coverage"][1]["scheduled_agents"], 0)
        self.assertEqual(result["coverage"][2]["scheduled_agents"], 0)


if __name__ == "__main__":
    unittest.main()
