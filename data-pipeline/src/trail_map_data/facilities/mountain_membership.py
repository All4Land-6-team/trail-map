"""후보 JSON에 DB 경계 기준 산 소속을 부여하는 공통 전처리 마지막 단계."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from .contract import normalize_facility
from .document import write_document


def _validate(document: dict, mountain_id: int) -> None:
    if isinstance(mountain_id, bool) or not isinstance(mountain_id, int) or mountain_id < 1:
        raise ValueError("invalid_mountain_id")
    if document.get("schemaVersion") not in (1, 2) or not document.get("facilities"):
        raise ValueError("invalid_candidate_document")
    records = document["facilities"]
    seen = set()
    for record in records:
        # 검증만 수행하고 원본 값은 그대로 유지한다.
        normalized = normalize_facility(record)
        key = normalized["sourceRecordId"]
        if key in seen:
            raise ValueError("duplicate_source_record_id")
        seen.add(key)


def _classify(document: dict, connection, *, mountain_id: int) -> dict:
    records = document["facilities"]
    mountain = connection.execute("""
        SELECT mountain_name, mountain_boundary IS NULL,
            ST_SRID(mountain_boundary), ST_IsValid(mountain_boundary),
            ST_IsEmpty(mountain_boundary), GeometryType(mountain_boundary),
            md5(ST_AsEWKB(mountain_boundary))
        FROM mountain WHERE mountain_id = %s
        """, (mountain_id,)).fetchone()
    if mountain is None:
        raise ValueError(f"mountain_not_found: {mountain_id}")
    name, missing, srid, valid, empty, kind, fingerprint = mountain
    if not missing and (srid != 4326 or not valid or empty or kind not in ("POLYGON", "MULTIPOLYGON")):
        raise ValueError("invalid_mountain_boundary")
    rows = connection.execute("""
        SELECT p.ordinality,
            CASE WHEN m.mountain_boundary IS NULL THEN NULL ELSE
                ST_Covers(m.mountain_boundary,
                    ST_SetSRID(ST_MakePoint((p.value->>'longitude')::double precision,
                        (p.value->>'latitude')::double precision), 4326)) END AS covered,
            CASE WHEN m.mountain_boundary IS NULL THEN false ELSE
                ST_Touches(m.mountain_boundary,
                    ST_SetSRID(ST_MakePoint((p.value->>'longitude')::double precision,
                        (p.value->>'latitude')::double precision), 4326)) END AS on_boundary
        FROM mountain m
        CROSS JOIN jsonb_array_elements(%s::jsonb) WITH ORDINALITY AS p(value, ordinality)
        WHERE m.mountain_id = %s ORDER BY p.ordinality
        """, (Jsonb(records), mountain_id)).fetchall()
    if len(rows) != len(records):
        raise ValueError("incomplete_boundary_classification")

    result = copy.deepcopy(document)
    counts = {"inside": 0, "onBoundary": 0, "outside": 0, "boundaryUnset": 0}
    for record, (_, covered, on_boundary) in zip(result["facilities"], rows):
        record["mountainId"] = mountain_id if missing or covered else None
        counts["boundaryUnset" if missing else "onBoundary" if on_boundary else "inside" if covered else "outside"] += 1
    result["schemaVersion"] = 2
    result["report"] = result.get("report") or {}
    result["report"]["mountainMembership"] = {
        "mountainId": mountain_id, "mountainName": name,
        "boundaryConfigured": not missing, "boundaryFingerprint": fingerprint,
        "predicate": "ST_Covers", "counts": counts,
        "total": len(records), "outsideRecordsRetained": True,
        "notice": "경계 미설정 시 기본 소속 할당은 산 내부의 공간 검증을 의미하지 않습니다.",
    }
    return result


def classify_documents(documents: list[dict], connection, *, mountain_id: int = 2) -> list[dict]:
    if not documents:
        raise ValueError("invalid_candidate_document")
    for document in documents:
        _validate(document, mountain_id)
    with connection.transaction():
        connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        return [_classify(document, connection, mountain_id=mountain_id) for document in documents]


def classify(document: dict, connection, *, mountain_id: int = 2) -> dict:
    return classify_documents([document], connection, mountain_id=mountain_id)[0]


def preprocess_many(documents: list[dict], *, mountain_id: int = 2) -> list[dict]:
    try:
        # libpq PG* 또는 pgpass를 사용한다. 원본 필드와 해시는 바꾸지 않는다.
        with psycopg.connect(connect_timeout=5) as connection:
            return classify_documents(documents, connection, mountain_id=mountain_id)
    except psycopg.Error as error:
        raise ValueError("mountain_database_error: DB 연결 및 PostGIS 구성을 확인하세요") from error


def preprocess(document: dict, *, mountain_id: int = 2) -> dict:
    return preprocess_many([document], mountain_id=mountain_id)[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--mountain-id", type=int, default=2)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("input_and_output_must_differ")
    try:
        document = json.loads(args.input.read_text(encoding="utf-8-sig"))
        result = preprocess(document, mountain_id=args.mountain_id)
        write_document(result, args.output, overwrite=args.overwrite)
    except (ValueError, OSError) as error:
        parser.exit(1, f"산 소속 판정 실패: {error}\n")
    print(json.dumps(result["report"]["mountainMembership"], ensure_ascii=True))


if __name__ == "__main__":
    main()
