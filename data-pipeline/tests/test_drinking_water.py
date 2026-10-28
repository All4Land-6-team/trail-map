import csv

import pytest

from trail_map_data.facilities.knps_drinking_water import preprocess


def structures(tmp_path, rows):
    path = tmp_path / "structures.csv"
    with path.open("w", encoding="cp949", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["시설물명칭", "상대위치", "X좌표", "Y좌표"])
        writer.writerows(rows)
    return path


def test_structures_exclude_missing_coordinates_other_facilities_and_other_regions(tmp_path):
    path = structures(tmp_path, [
        ("시험샘", "도봉산", 127.02, 37.7),
        ("음수대", "구기분소옆", "", ""),
        ("회룡약수터옆 원도봉 회룡벤치", "회룡계곡", 127.03, 37.72),
        ("음수대", "다른 공원", 128, 35),
        ("시험약수", "북한산", "NaN", 37.65),
        ("시험약수", "북한산", 37.65, 127),
    ])
    result = preprocess(path, kind="structures")
    assert [r["name"] for r in result["facilities"]] == ["시험샘"]
    assert result["facilities"][0]["type"] == "DRINKING_WATER"
    assert result["facilities"][0]["sourceReportedStatus"] is None
    assert result["report"]["excludedByReason"] == {
        "missing_coordinates": 1, "not_water_facility": 1,
        "outside_candidate_bounds": 1, "invalid_coordinates": 2,
    }
    assert result["report"]["included"] + result["report"]["excluded"] == 6


def test_reviewed_aliases_merge_deterministically_and_keep_original_provenance(tmp_path):
    rows = [
        ("망월사아래 덕재샘", "망월사아래 덕재샘", 127.0238037, 37.70263672),
        ("망월사하단   덕재샘", "망월사하단   덕재샘", 127.0236206, 37.70263672),
        ("다른샘", "같은 위치의 다른 시설", 127.0236206, 37.70263672),
    ]
    first = preprocess(structures(tmp_path, rows), kind="structures")
    second = preprocess(structures(tmp_path, list(reversed(rows))), kind="structures")
    assert first["facilities"] == second["facilities"]
    assert len(first["facilities"]) == 2
    selected = next(r for r in first["facilities"] if r["sourceRecordId"] == "reviewed-deokjaesaem")
    assert selected["longitude"] == 127.0236206  # 평균 좌표를 만들지 않는다.
    assert selected["name"] == "망월사하단 덕재샘"
    assert len(first["report"]["sourceRecords"]) == 3
    assert len(first["report"]["mergedRecords"][0]["members"]) == 2
    assert first["report"]["excludedByReason"]["reviewed_duplicate_facility"] == 1


def test_aliases_with_changed_locations_require_review(tmp_path):
    path = structures(tmp_path, [
        ("망월사하단 덕재샘", "망월사", 127.02, 37.70),
        ("망월사아래 덕재샘", "망월사", 127.04, 37.72),
    ])
    with pytest.raises(ValueError, match="reviewed_alias_coordinates_changed"):
        preprocess(path, kind="structures")


def test_exact_duplicates_skip_but_conflicting_coordinates_fail(tmp_path):
    row = ("시험샘", "도봉산", 127.02, 37.70)
    result = preprocess(structures(tmp_path, [row, row]), kind="structures")
    assert len(result["facilities"]) == 1
    assert result["report"]["excludedByReason"]["duplicate_source_record_id"] == 1
    with pytest.raises(ValueError, match="conflicting_duplicate"):
        preprocess(structures(tmp_path, [row, ("시험샘", "도봉산", 127.03, 37.70)]), kind="structures")


def test_springs_use_csv_longitude_latitude_and_filter_park(tmp_path):
    path = tmp_path / "springs.csv"
    with path.open("w", encoding="cp949", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["국립공원", "지점명", "지점주소", "경도", "위도"])
        writer.writerows([
            ("북한산", "시험 샘터", "시험 주소", 126.95, 37.61),
            ("지리산", "다른 샘터", "시험 주소", 127.61, 35.33),
            ("북한산", "좌표없는샘", "시험 주소", "", ""),
        ])
    result = preprocess(path, kind="springs")
    assert len(result["facilities"]) == 1
    point = result["facilities"][0]
    assert (point["longitude"], point["latitude"]) == (126.95, 37.61)
    assert point["sourceDate"] == "2024-05-22"
    assert result["source"]["version"] == "20240522"
    assert result["report"]["excludedByReason"] == {"outside_park": 1, "missing_coordinates": 1}


def test_no_valid_records_and_wrong_schema_fail(tmp_path):
    with pytest.raises(ValueError, match="no_valid_selected_records"):
        preprocess(structures(tmp_path, [("음수대", "북한산", "", "")]), kind="structures")
    with pytest.raises(ValueError, match="required_fields_missing"):
        preprocess(structures(tmp_path, []), kind="springs")


def test_synthetic_id_is_independent_of_row_order_and_coordinates(tmp_path):
    first = preprocess(structures(tmp_path, [("음수대", "위치", 127.01, 37.7)]), kind="structures")
    second = preprocess(structures(tmp_path, [("음수대", "위치", 127.02, 37.7)]), kind="structures")
    assert first["facilities"][0]["sourceRecordId"] == second["facilities"][0]["sourceRecordId"]
    assert first["facilities"][0] != second["facilities"][0]  # JDBC 적재기는 변경을 감지하고 중단한다.
