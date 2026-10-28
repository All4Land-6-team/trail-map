"""KNPS 화장실 SHP를 공통 facility import JSON으로 변환한다."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

import shapefile
from pyproj import CRS, Transformer

from .contract import add_facility, identifier, normalize_facility
from .document import write_document


def preprocess(input_path: Path, *, park_code: str, source_date: str = "2014-12-19",
               encoding: str = "cp949") -> dict:
    input_path = Path(input_path)
    # CRS가 없으면 좌표계를 추정하지 않고 원본 확인을 요구한다.
    source_crs = CRS.from_wkt(input_path.with_suffix(".prj").read_text(encoding="utf-8-sig"))
    transformer = Transformer.from_crs(source_crs, "EPSG:4326", always_xy=True)
    records: dict[str, dict] = {}
    excluded: Counter[str] = Counter()
    rejected = []
    total = selected = 0
    with shapefile.Reader(str(input_path), encoding=encoding) as reader:
        required = {"OBJECTID", "PO_CD", "KOR_NM", "USE_YN"}
        if not required.issubset({field[0] for field in reader.fields[1:]}):
            raise ValueError("required_fields_missing")
        for item in reader.iterShapeRecords():
            total += 1
            attributes = item.record.as_dict()
            if str(attributes["PO_CD"]).strip() != str(park_code):
                excluded["outside_park_code"] += 1
                continue
            selected += 1
            try:
                record_id = identifier(attributes["OBJECTID"])
                if item.shape.shapeType not in {shapefile.POINT, shapefile.POINTM, shapefile.POINTZ} or len(item.shape.points) != 1:
                    raise ValueError("not_a_point")
                # 원본은 PointZ일 수 있다. 시설 테이블은 2D Point이므로 XY만 변환한다.
                longitude, latitude = transformer.transform(*item.shape.points[0][:2])
                use_yn = attributes["USE_YN"]
                record = normalize_facility({
                    "sourceRecordId": record_id,
                    "type": "RESTROOM",
                    "name": attributes["KOR_NM"],
                    "longitude": longitude,
                    "latitude": latitude,
                    "sourceReportedStatus": None if use_yn is None else f"USE_YN={use_yn}",
                    "sourceDate": source_date,
                })
            except ValueError as error:
                reason = str(error)
                excluded[reason] += 1
                rejected.append({"sourceRecordId": str(attributes.get("OBJECTID")), "reason": reason})
                continue
            if not add_facility(records, record):
                excluded["duplicate_source_record_id"] += 1
                rejected.append({"sourceRecordId": record_id, "reason": "duplicate_source_record_id"})
                continue
            # 서로 다른 OBJECTID의 좌표 중복은 실제 시설일 수 있으므로 보존한다.
    if not records:
        raise ValueError(f"no_valid_selected_records: {dict(excluded)}")
    return {
        "schemaVersion": 1,
        "source": {
            "name": "국립공원공단 국립공원 화장실 공간데이터",
            "provider": "국립공원공단",
            "url": None,
            "format": "SHP",
            "crs": source_crs.to_string(),
            "version": source_date.replace("-", ""),
        },
        "facilities": list(records.values()),
        "report": {
            "totalRead": total, "selected": selected, "included": len(records),
            "excluded": sum(excluded.values()), "excludedByReason": dict(excluded),
            "rejectedRecords": rejected,
            "selection": {"field": "PO_CD", "value": str(park_code)},
            "coordinateSystem": "EPSG:4326",
            "notice": "공원코드 후보이며 북한산·도봉산 구분 전입니다. USE_YN은 원본 기준일의 값입니다.",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--park-code", required=True)
    parser.add_argument("--source-date", default="2014-12-19")
    parser.add_argument("--encoding", default="cp949")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    try:
        document = preprocess(args.input, park_code=args.park_code,
                              source_date=args.source_date, encoding=args.encoding)
        write_document(document, args.output, overwrite=args.overwrite)
    except (ValueError, OSError, shapefile.ShapefileException) as error:
        parser.exit(1, f"전처리 실패: {error}\n")
    print(json.dumps(document["report"], ensure_ascii=True))


if __name__ == "__main__":
    main()
