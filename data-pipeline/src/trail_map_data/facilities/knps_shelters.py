"""기타구축물 CSV의 좌표 있는 북한산·도봉산 쉼터를 공통 시설 JSON으로 변환한다."""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

from .contract import add_facility, normalize_facility
from .csv_common import BOUNDS, clean, record_identity, validate_candidate_bounds
from .document import write_document


# 공원 코드가 없는 원본에서 두 산을 추리는 기존 음수대와 같은 검토 범위.
# 실제 공원 경계 폴리곤이 아니며 원본 버전이 바뀌면 포함 시설을 재검토한다.
REQUIRED_FIELDS = {"시설물명칭", "상대위치", "X좌표", "Y좌표"}
SHELTER_NAME = re.compile(r"파고라|쉼터|정자")
NON_SHELTER = re.compile(r"벤치|의자|휀스|난간|가드레일|화장실|계수기|게시판|소각|차단기")



def preprocess(input_path: Path, *, source_date: str = "2024-09-11",
               encoding: str = "cp949") -> dict:
    source_date = date.fromisoformat(source_date).isoformat()
    records: dict[str, dict] = {}
    excluded: Counter[str] = Counter()
    rejected, provenance = [], []
    total = selected = 0
    with Path(input_path).open(encoding=encoding, newline="") as stream:
        reader = csv.DictReader(stream)
        fields = reader.fieldnames or []
        if not REQUIRED_FIELDS.issubset(fields) or len(fields) != len(set(fields)):
            raise ValueError("required_fields_missing_or_duplicated")
        for row_number, row in enumerate(reader, start=2):
            total += 1
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"malformed_csv_row: {row_number}")
            name, location = clean(row["시설물명칭"]), clean(row["상대위치"])
            try:
                # 시설 종류와 관계없이 X·Y가 모두 있는 행만 다음 조건을 검사한다.
                if not clean(row["X좌표"]) or not clean(row["Y좌표"]):
                    raise ValueError("missing_coordinates")
                # 위치 설명에 '쉼터'가 있는 벤치·의자와 종류 불명 구조물은 제외한다.
                # 부속 벤치 개수는 파고라·쉼터 자체를 제외하는 근거로 쓰지 않는다.
                if NON_SHELTER.search(name) or not SHELTER_NAME.search(name):
                    raise ValueError("not_shelter_structure")
                selected += 1
                record_id = record_identity(name, location)
                record = normalize_facility({
                    "sourceRecordId": record_id, "type": "SHELTER", "name": name,
                    "longitude": row["X좌표"], "latitude": row["Y좌표"],
                    "sourceDate": source_date, "sourceReportedStatus": None,
                })
                validate_candidate_bounds(record)
            except ValueError as error:
                reason = str(error)
                excluded[reason] += 1
                rejected.append({"row": row_number, "name": name,
                                 "location": location, "reason": reason})
                continue

            provenance.append({"row": row_number, "sourceRecordId": record_id,
                               "attributes": row})
            if not add_facility(records, record):
                excluded["duplicate_source_record_id"] += 1
                rejected.append({"row": row_number, "name": name, "location": location,
                                 "reason": "duplicate_source_record_id"})
                continue
            # 좌표만 같은 서로 다른 시설을 합치거나 평균 좌표를 만들지 않는다.

    if not records:
        raise ValueError(f"no_valid_selected_records: {dict(excluded)}")
    return {
        "schemaVersion": 1,
        "source": {"name": "국립공원공단 기타구축물", "provider": "국립공원공단",
                   "url": None, "format": "CSV", "crs": "EPSG:4326",
                   "version": source_date.replace("-", "")},
        "facilities": sorted(records.values(), key=lambda item: item["sourceRecordId"]),
        "report": {
            "totalRead": total, "selected": selected, "included": len(records),
            "excluded": sum(excluded.values()), "excludedByReason": dict(excluded),
            "rejectedRecords": rejected, "sourceRecords": provenance,
            "selection": {"candidateBounds": list(BOUNDS),
                          "namePattern": SHELTER_NAME.pattern,
                          "excludedNamePattern": NON_SHELTER.pattern},
            "notice": "CSV에 좌표가 있는 쉼터 후보입니다. 현재 운영 여부는 미확인입니다.",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--encoding", default="cp949")
    parser.add_argument("--source-date", default="2024-09-11")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("input_and_output_must_differ")
    try:
        document = preprocess(args.input, source_date=args.source_date, encoding=args.encoding)
        write_document(document, args.output, overwrite=args.overwrite)
    except (ValueError, OSError, csv.Error) as error:
        parser.exit(1, f"전처리 실패: {error}\n")
    print(json.dumps({key: document["report"][key] for key in
                      ("totalRead", "included", "excludedByReason")}, ensure_ascii=True))


if __name__ == "__main__":
    main()
