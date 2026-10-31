"""새 시설 후보를 DB 산 경계와 대조해 한 산에 속한 후보만 적재용 JSON으로 만든다."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from .contract import normalize_facility
from .document import write_document


def _validate(document: dict) -> tuple[dict, list[dict], set[str]]:
    if document.get("schemaVersion") not in (1, 2) or not isinstance(document.get("facilities"), list):
        raise ValueError("invalid_candidate_document")
    source = document.get("source")
    if not isinstance(source, dict) or any(not source.get(key) for key in ("name", "format", "version")):
        raise ValueError("invalid_candidate_source")
    records = [normalize_facility(record) for record in document["facilities"]]
    seen = set()
    for record in records:
        key = record["sourceRecordId"]
        if key in seen:
            raise ValueError("duplicate_source_record_id")
        seen.add(key)
    return source, records, seen


def _classify(document: dict, source: dict, records: list[dict], seen: set[str],
              connection, boundaries: list[tuple]) -> dict:
    sources = connection.execute("""
        SELECT source_id, source_url, source_crs FROM data_source
        WHERE source_name = %s AND provider_name IS NOT DISTINCT FROM %s
            AND source_format = %s AND source_version = %s
        """, (source["name"], source.get("provider"), source["format"], source["version"])).fetchall()
    if len(sources) > 1:
        raise ValueError("ambiguous_data_source")
    existing_ids = set()
    if sources:
        source_id, source_url, source_crs = sources[0]
        if source_url != source.get("url") or source_crs != source.get("crs"):
            raise ValueError("source_metadata_changed")
        if records:
            existing_ids = {row[0] for row in connection.execute("""
                SELECT source_record_id FROM facility
                WHERE source_id = %s AND source_record_id = ANY(%s)
                """, (source_id, list(seen))).fetchall()}

    new_records = [record for record in records if record["sourceRecordId"] not in existing_ids]
    rows = connection.execute("""
        WITH points AS (
            SELECT p.ordinality,
                ST_SetSRID(ST_MakePoint((p.value->>'longitude')::double precision,
                    (p.value->>'latitude')::double precision), 4326) AS geom
            FROM jsonb_array_elements(%s::jsonb) WITH ORDINALITY AS p(value, ordinality)
        )
        SELECT p.ordinality,
            COALESCE(array_agg(m.mountain_id ORDER BY m.mountain_id)
                FILTER (WHERE m.mountain_id IS NOT NULL), '{}'::bigint[]) AS mountain_ids,
            COALESCE(bool_or(ST_Touches(m.mountain_boundary, p.geom)), false) AS on_boundary
        FROM points p LEFT JOIN mountain m
            ON m.mountain_boundary IS NOT NULL AND ST_Covers(m.mountain_boundary, p.geom)
        GROUP BY p.ordinality ORDER BY p.ordinality
        """, (Jsonb(new_records),)).fetchall() if new_records else []
    if len(rows) != len(new_records):
        raise ValueError("incomplete_boundary_classification")

    result = copy.deepcopy(document)
    result["schemaVersion"] = 2
    result["facilities"] = []
    counts = {"inside": 0, "onBoundary": 0, "outside": 0, "multipleMatches": 0, "existing": 0}
    excluded = []
    for record in records:
        if record["sourceRecordId"] in existing_ids:
            counts["existing"] += 1
            excluded.append({"sourceRecordId": record["sourceRecordId"], "reason": "existing"})
    for record, (_, mountain_ids, on_boundary) in zip(new_records, rows):
        if len(mountain_ids) == 1:
            included = copy.deepcopy(record)
            included["mountainId"] = mountain_ids[0]
            result["facilities"].append(included)
            counts["onBoundary" if on_boundary else "inside"] += 1
        else:
            reason = "outside" if not mountain_ids else "multipleMatches"
            counts[reason] += 1
            excluded.append({"sourceRecordId": record["sourceRecordId"], "reason": reason})
    result["report"] = result.get("report") or {}
    result["report"]["mountainMembership"] = {
        "predicate": "ST_Covers", "boundaryFingerprints": {str(row[0]): row[5] for row in boundaries},
        "counts": counts, "total": len(records), "included": len(result["facilities"]),
        "excludedRecords": excluded,
        "notice": "새 시설만 판정하며 경계 밖·다중 일치는 저장하지 않습니다. 경계 자료의 정확도는 별도로 확인해야 합니다.",
    }
    return result


def classify_documents(documents: list[dict], connection) -> list[dict]:
    if not documents:
        raise ValueError("invalid_candidate_document")
    validated = [_validate(document) for document in documents]
    with connection.transaction():
        # 모든 출처의 기존 시설 조회와 경계 판정에 같은 읽기 전용 DB 스냅샷을 사용한다.
        connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        boundaries = connection.execute("""
            SELECT mountain_id, ST_SRID(mountain_boundary), ST_IsValid(mountain_boundary),
                ST_IsEmpty(mountain_boundary), GeometryType(mountain_boundary),
                md5(ST_AsEWKB(mountain_boundary))
            FROM mountain WHERE mountain_boundary IS NOT NULL ORDER BY mountain_id
            """).fetchall()
        if any(srid != 4326 or not valid or empty or kind not in ("POLYGON", "MULTIPOLYGON")
               for _, srid, valid, empty, kind, _ in boundaries):
            raise ValueError("invalid_mountain_boundary")
        return [_classify(document, *parts, connection, boundaries)
                for document, parts in zip(documents, validated)]


def classify(document: dict, connection) -> dict:
    return classify_documents([document], connection)[0]


def preprocess_many(documents: list[dict]) -> list[dict]:
    try:
        # libpq PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD 또는 pgpass를 사용한다.
        with psycopg.connect(connect_timeout=5) as connection:
            return classify_documents(documents, connection)
    except psycopg.Error as error:
        # DSN/비밀값이 오류 로그에 노출되지 않도록 DB 오류 상세는 출력하지 않는다.
        raise ValueError("mountain_database_error: DB 연결 및 PostGIS 구성을 확인하세요") from error


def preprocess(document: dict) -> dict:
    return preprocess_many([document])[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("input_and_output_must_differ")
    try:
        document = json.loads(args.input.read_text(encoding="utf-8-sig"))
        result = preprocess(document)
        write_document(result, args.output, overwrite=args.overwrite)
    except (ValueError, OSError) as error:
        parser.exit(1, f"산 소속 판정 실패: {error}\n")
    print(json.dumps(result["report"]["mountainMembership"], ensure_ascii=True))


if __name__ == "__main__":
    main()
