"""원본 형식에 독립적인 시설 원본 필드 검증. 산 소속은 별도 판정한다."""

from __future__ import annotations

import math
from datetime import date
from typing import Any

FACILITY_TYPES = {"RESTROOM", "SHELTER", "DRINKING_WATER"}


def add_facility(records: dict[str, dict], record: dict) -> bool:
    """같은 원본 ID의 동일 행은 건너뛰고 내용 충돌은 거부한다."""
    key = record["sourceRecordId"]
    if key in records:
        if records[key] != record:
            raise ValueError(f"conflicting_duplicate_source_record_id: {key}")
        return False
    records[key] = record
    return True


def identifier(value: Any) -> str:
    if value is None or isinstance(value, bool):
        raise ValueError("missing_source_record_id")
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        value = int(value)
    result = str(value).strip()
    if not result or len(result) > 200:
        raise ValueError("invalid_source_record_id")
    return result


def _text(value: Any, limit: int) -> str | None:
    result = None if value is None else str(value).strip() or None
    if result is not None and len(result) > limit:
        raise ValueError("text_too_long")
    return result


def normalize_facility(record: dict[str, Any]) -> dict[str, Any]:
    """좌표는 어댑터가 WGS84 경도·위도로 변환해서 전달해야 한다."""
    source_id = identifier(record.get("sourceRecordId"))
    facility_type = record.get("type")
    if facility_type not in FACILITY_TYPES:
        raise ValueError("invalid_facility_type")
    try:
        if isinstance(record.get("longitude"), bool) or isinstance(record.get("latitude"), bool):
            raise ValueError
        longitude, latitude = float(record["longitude"]), float(record["latitude"])
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError("invalid_coordinates") from error
    if not (math.isfinite(longitude) and math.isfinite(latitude)):
        raise ValueError("invalid_coordinates")
    if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
        raise ValueError("invalid_coordinates")
    source_date = record.get("sourceDate")
    if source_date is not None:
        try:
            source_date = date.fromisoformat(source_date).isoformat()
        except (TypeError, ValueError) as error:
            raise ValueError("invalid_source_date") from error
    return {
        "sourceRecordId": source_id,
        "type": facility_type,
        "name": _text(record.get("name"), 200),
        "longitude": longitude,
        "latitude": latitude,
        "sourceReportedStatus": _text(record.get("sourceReportedStatus"), 100),
        "sourceDate": source_date,
    }
