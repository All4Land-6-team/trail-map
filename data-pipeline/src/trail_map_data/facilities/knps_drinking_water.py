"""북한산·도봉산의 좌표 있는 샘터/기타구축물 CSV를 음수대 JSON으로 변환한다."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from collections import Counter
from datetime import date
from pathlib import Path

from .contract import add_facility, normalize_facility
from .csv_common import BOUNDS, clean, record_identity, validate_candidate_bounds
from .document import write_document

# 기타구축물에는 공원 코드가 없다. 검토한 두 산의 후보 범위이며 공원 경계가 아니다.
SOURCES = {
    "springs": ("국립공원공단 국립공원 샘터", "2024-05-22",
                {"국립공원", "지점명", "지점주소", "경도", "위도"}),
    "structures": ("국립공원공단 기타구축물", "2024-09-11",
                   {"시설물명칭", "상대위치", "X좌표", "Y좌표"}),
}
# 원본 두 명칭은 망월사 아래 같은 샘을 가리키며 좌표 차이는 약 16m다.
# 이 명칭 쌍만 30m 이내일 때 통합한다. 임의의 근접 시설은 합치지 않는다.
DEOKJAE_ALIASES = {"망월사하단 덕재샘", "망월사아래 덕재샘"}
NON_WATER = re.compile(r"벤치|의자|휀스|난간|가드레일|파고라|경보|소각|화장실|계수기|게시판|데크")
WATER_NAME = re.compile(r"음수대|약수터|약수$|샘(?:터)?(?:\(|$)|용천수$")
NAMED_SPRINGS = {"세심천", "청수천", "영천", "신성천", "용화천", "용천"}



def meters_between(a: dict, b: dict) -> float:
    lat1, lat2 = map(math.radians, (a["latitude"], b["latitude"]))
    delta_lon = math.radians(a["longitude"] - b["longitude"])
    h = math.sin((lat1 - lat2) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return 6_371_008.8 * 2 * math.asin(min(1, math.sqrt(h)))


def preprocess(input_path: Path, *, kind: str, source_date: str | None = None,
               encoding: str = "cp949") -> dict:
    source_name, default_date, required = SOURCES[kind]
    source_date = date.fromisoformat(source_date or default_date).isoformat()
    excluded: Counter[str] = Counter()
    rejected, provenance, merged = [], [], []
    records: dict[str, dict] = {}
    total = selected = 0
    with Path(input_path).open(encoding=encoding, newline="") as stream:
        reader = csv.DictReader(stream)
        if not required.issubset(reader.fieldnames or []) or len(reader.fieldnames or []) != len(set(reader.fieldnames or [])):
            raise ValueError("required_fields_missing")
        for row_number, row in enumerate(reader, start=2):
            total += 1
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"malformed_csv_row: {row_number}")
            name = clean(row["지점명"] if kind == "springs" else row["시설물명칭"])
            location = clean(row["지점주소"] if kind == "springs" else row["상대위치"])
            raw_id = record_identity(name, location)
            try:
                if kind == "springs":
                    if clean(row["국립공원"]) not in {"북한산", "도봉산"}:
                        raise ValueError("outside_park")
                    longitude, latitude = row["경도"], row["위도"]
                else:
                    if NON_WATER.search(name) or not (WATER_NAME.search(name) or name in NAMED_SPRINGS):
                        raise ValueError("not_water_facility")
                    longitude, latitude = row["X좌표"], row["Y좌표"]
                selected += 1
                if not clean(longitude) or not clean(latitude):
                    raise ValueError("missing_coordinates")
                if not name:
                    raise ValueError("missing_name")
                record = normalize_facility({
                    "sourceRecordId": raw_id, "type": "DRINKING_WATER", "name": name,
                    "longitude": longitude, "latitude": latitude, "sourceDate": source_date,
                    "sourceReportedStatus": None,
                })
                validate_candidate_bounds(record)
            except ValueError as error:
                reason = str(error)
                excluded[reason] += 1
                rejected.append({"row": row_number, "name": name, "location": location, "reason": reason})
                continue

            provenance.append({"row": row_number, "sourceRecordId": raw_id, "attributes": row})
            if not add_facility(records, record):
                excluded["duplicate_source_record_id"] += 1
                continue

    aliases = [record for record in records.values() if kind == "structures" and record["name"] in DEOKJAE_ALIASES]
    if aliases:
        representative = min(aliases, key=lambda record: (record["longitude"], record["latitude"], record["name"]))
        if any(meters_between(representative, record) > 30 for record in aliases):
            raise ValueError("reviewed_alias_coordinates_changed: deokjaesaem")
        for record in aliases:
            del records[record["sourceRecordId"]]
        key = "reviewed-deokjaesaem"
        records[key] = representative | {"sourceRecordId": key}
        excluded["reviewed_duplicate_facility"] += len(aliases) - 1
        merged.append({"sourceRecordId": key, "members": aliases,
                       "selectedRecordId": representative["sourceRecordId"],
                       "rule": "reviewed_deokjaesaem_names_within_30m; smallest_longitude_then_latitude"})
    if not records:
        raise ValueError(f"no_valid_selected_records: {dict(excluded)}")
    return {
        "schemaVersion": 1,
        "source": {"name": source_name, "provider": "국립공원공단", "url": None,
                   "format": "CSV", "crs": "EPSG:4326", "version": source_date.replace("-", "")},
        "facilities": sorted(records.values(), key=lambda record: record["sourceRecordId"]),
        "report": {
            "totalRead": total, "selected": selected, "included": len(records),
            "excluded": sum(excluded.values()), "excludedByReason": dict(excluded),
            "rejectedRecords": rejected, "sourceRecords": provenance, "mergedRecords": merged,
            "selection": {"kind": kind, "candidateBounds": list(BOUNDS)},
            "notice": "북한산·도봉산 후보 범위. 좌표 없는 시설은 제외하며 이용 가능·음용 적합 여부는 미확인입니다.",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=SOURCES)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--encoding", default="cp949")
    parser.add_argument("--source-date")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("input_and_output_must_differ")
    try:
        document = preprocess(args.input, kind=args.kind, source_date=args.source_date, encoding=args.encoding)
        write_document(document, args.output, overwrite=args.overwrite)
    except (ValueError, OSError) as error:
        parser.exit(1, f"전처리 실패: {error}\n")
    print(json.dumps({key: document["report"][key] for key in ("totalRead", "included", "excludedByReason")}, ensure_ascii=True))


if __name__ == "__main__":
    main()
