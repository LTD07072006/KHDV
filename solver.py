"""Public solver entry point for ``SchedulingRequest v1.0.0``."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Mapping

from scheduling_contract import load_json, validate_result, write_json
from scheduling_solver import solve_request


def solve_contract(request: Mapping[str, Any]) -> dict[str, Any]:
    """Solve one v1.0.0 request and reject the retired intervals/roster format."""
    if request.get("contract_version") != "1.0.0":
        raise ValueError("solver.py chỉ nhận SchedulingRequest v1.0.0; format intervals/roster cũ đã bị loại.")
    return solve_request(request)


def solve_file(request_path: str | Path, output_path: str | Path) -> dict[str, Any]:
    result = solve_contract(load_json(request_path))
    validate_result(result)
    write_json(result, output_path, result=True)
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("scheduling_result.json"))
    return parser


def main() -> None:
    args = build_parser().parse_args()
    result = solve_file(args.request, args.output)
    print(f"Status: {result['status']}; solver: {result['solver_status']}; assignments: {len(result['assignments'])}")


if __name__ == "__main__":
    main()
