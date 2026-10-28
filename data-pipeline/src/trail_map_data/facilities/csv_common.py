"""CSV 시설 어댑터가 공유하는 검토 범위·정규화·안정적인 원본 식별자."""

import hashlib
import json

# 후보 선별 범위이며 산 경계를 대신하지 않는다.
BOUNDS = (126.90, 37.59, 127.07, 37.75)


def clean(value: str | None) -> str:
    return " ".join((value or "").split())


def record_identity(name: str, location: str) -> str:
    # 기존 적재 ID와 동일하게 유지한다. 좌표나 행 순서는 식별자에 넣지 않는다.
    value = json.dumps([name, location], ensure_ascii=False, separators=(",", ":"))
    return "csv-" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def validate_candidate_bounds(record: dict) -> None:
    west, south, east, north = BOUNDS
    if not (west <= record["longitude"] <= east and south <= record["latitude"] <= north):
        raise ValueError("outside_candidate_bounds")
