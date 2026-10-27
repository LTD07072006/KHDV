"""Validation and I/O helpers for the single scheduling contract.

The active application boundary is deliberately small:

* ``SchedulingRequest v1.0.0`` enters the solver.
* ``SchedulingResult v1.0.0`` leaves the solver.

Workbook parsing belongs to :mod:`workbook_adapter`; this module only validates
the serialized contract against the checked-in JSON Schemas.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping


ROOT = Path(__file__).resolve().parent
SCHEMA_DIR = ROOT / "docs" / "contracts"
REQUEST_SCHEMA_PATH = SCHEMA_DIR / "scheduling-request.schema.json"
RESULT_SCHEMA_PATH = SCHEMA_DIR / "scheduling-result.schema.json"


class ContractValidationError(ValueError):
    """Raised when a request or result is not valid for the active contract."""


def _load_schema(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Không đọc được schema contract: {path}") from exc


def _validate(payload: Mapping[str, Any], schema_path: Path, label: str) -> dict[str, Any]:
    try:
        from jsonschema import Draft202012Validator, FormatChecker
    except ImportError as exc:  # pragma: no cover - dependency setup error
        raise RuntimeError(
            "Cần cài jsonschema để kiểm tra SchedulingRequest/SchedulingResult."
        ) from exc

    validator = Draft202012Validator(_load_schema(schema_path), format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(payload), key=lambda error: list(error.path))
    if errors:
        first = errors[0]
        path = "/" + "/".join(str(part) for part in first.path) or "/"
        raise ContractValidationError(f"{label} không hợp lệ tại {path}: {first.message}")
    return dict(payload)


def validate_request(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Validate and return a copy of a ``SchedulingRequest v1.0.0``."""

    return _validate(payload, REQUEST_SCHEMA_PATH, "SchedulingRequest v1.0.0")


def validate_result(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Validate and return a copy of a ``SchedulingResult v1.0.0``."""

    return _validate(payload, RESULT_SCHEMA_PATH, "SchedulingResult v1.0.0")


def load_json(path: str | Path) -> dict[str, Any]:
    """Load a JSON object and validate it as the request contract."""

    source = Path(path)
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractValidationError(f"Không đọc được request JSON: {source}") from exc
    if not isinstance(payload, Mapping):
        raise ContractValidationError("SchedulingRequest phải là một JSON object.")
    return validate_request(payload)


def write_json(payload: Mapping[str, Any], path: str | Path, *, result: bool = False) -> None:
    """Validate and write a request or result JSON document."""

    checked = validate_result(payload) if result else validate_request(payload)
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(checked, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
