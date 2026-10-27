"""원본 세 자료를 출처별 시설 JSON v2로 한 번에 전처리한다."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

import shapefile

from . import knps_drinking_water, knps_restrooms, knps_shelters, mountain_membership
from .contract import add_facility, normalize_facility
from .document import write_document

OUTPUT_NAMES = ("restrooms.json", "springs.json", "structures.json")


def merge_source_documents(*documents: dict) -> dict:
    """같은 출처의 유형별 후보를 합친다. 중복 ID 충돌은 적재 전에 거부한다."""
    source = documents[0]["source"]
    records: dict[str, dict] = {}
    reports = {}
    for document in documents:
        if document["source"] != source:
            raise ValueError("different_sources_cannot_be_merged")
        kinds = {record["type"] for record in document["facilities"]}
        if len(kinds) != 1 or next(iter(kinds)) in reports:
            raise ValueError("expected_distinct_single_type_documents")
        reports[next(iter(kinds))] = document["report"]
        for record in document["facilities"]:
            add_facility(records, normalize_facility(record))
    return {
        "schemaVersion": 1, "source": source,
        "facilities": sorted(records.values(), key=lambda record: record["sourceRecordId"]),
        "report": {"included": len(records), "byType": reports,
                   "notice": "동일 원본의 유형별 제외 통계는 서로 겹치므로 합산하지 않습니다."},
    }


def build_candidates(*, restrooms: Path, springs: Path, structures: Path,
                     park_code: str = "1501", encoding: str = "cp949",
                     restroom_date: str = "2014-12-19", spring_date: str = "2024-05-22",
                     structure_date: str = "2024-09-11") -> list[dict]:
    return [
        knps_restrooms.preprocess(restrooms, park_code=park_code,
                                 source_date=restroom_date, encoding=encoding),
        knps_drinking_water.preprocess(springs, kind="springs",
                                      source_date=spring_date, encoding=encoding),
        merge_source_documents(
            knps_drinking_water.preprocess(structures, kind="structures",
                                          source_date=structure_date, encoding=encoding),
            knps_shelters.preprocess(structures, source_date=structure_date, encoding=encoding)),
    ]


def run(*, output_dir: Path, mountain_id: int = 2, overwrite: bool = False, **inputs) -> dict:
    output_dir = Path(output_dir)
    paths = [output_dir / name for name in (*OUTPUT_NAMES, "report.json")]
    input_paths = {Path(inputs[name]).resolve() for name in ("restrooms", "springs", "structures")}
    for path in paths:
        if path.resolve() in input_paths:
            raise ValueError("input_and_output_must_differ")
        if path.exists() and (not overwrite or not path.is_file()):
            raise FileExistsError(path)
    candidates = build_candidates(**inputs)
    # 전 출처를 같은 경계 스냅샷으로 판정한다. 실패 시 출력 파일을 만들지 않는다.
    documents = mountain_membership.preprocess_many(candidates, mountain_id=mountain_id)
    counts = Counter(record["type"] for document in documents for record in document["facilities"])
    report = {
        "schemaVersion": 2, "total": sum(counts.values()), "byType": dict(sorted(counts.items())),
        "sources": [{"file": name, "source": document["source"], "report": document["report"]}
                    for name, document in zip(OUTPUT_NAMES, documents)],
    }
    for path, document in zip(paths, [*documents, report]):
        write_document(document, path, overwrite=overwrite)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("restrooms", "springs", "structures"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--park-code", default="1501")
    parser.add_argument("--mountain-id", type=int, default=2)
    parser.add_argument("--encoding", default="cp949")
    parser.add_argument("--restroom-date", default="2014-12-19")
    parser.add_argument("--spring-date", default="2024-05-22")
    parser.add_argument("--structure-date", default="2024-09-11")
    parser.add_argument("--overwrite", action="store_true")
    try:
        report = run(**vars(parser.parse_args()))
    except (ValueError, OSError, csv.Error, shapefile.ShapefileException) as error:
        parser.exit(1, f"시설 전처리 실패: {error}\n")
    print(json.dumps({"total": report["total"], "byType": report["byType"]}, ensure_ascii=True))


if __name__ == "__main__":
    main()
