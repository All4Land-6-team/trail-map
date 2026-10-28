import csv
import json
import sys

import pytest

from trail_map_data.facilities.knps_shelters import main, preprocess


def structures(tmp_path, rows, *, encoding="cp949"):
    path = tmp_path / "structures.csv"
    with path.open("w", encoding=encoding, newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["시설물명칭", "상대위치", "X좌표", "Y좌표", "벤치개수"])
        writer.writerows(rows)
    return path


def test_selects_structures_and_keeps_attached_benches(tmp_path):
    rows = [
        ("송추파고라", "입구", 126.99, 37.71, 5),
        ("원도봉 진입부 쉼터", "사무소 앞", 127.03, 37.70, 8),
        ("정자", "능선", 127.01, 37.68, ""),
        ("우이령 목재의자", "우이령 정상 쉼터", 127.01, 37.68, 6),
        ("두꺼비바위쉼터(원도봉 벤치)", "원도봉", 127.01, 37.68, ""),
        ("와글와글 식당 위", "쉼터 옆", 127.01, 37.68, ""),
        ("화장실", "파고라 옆", 127.01, 37.68, ""),
        ("파고라", "좌표 없음", "", "", ""),
        ("쉼터", "다른 지역", 128, 35, ""),
    ]
    result = preprocess(structures(tmp_path, rows))
    assert {record["name"] for record in result["facilities"]} == {
        "송추파고라", "원도봉 진입부 쉼터", "정자",
    }
    assert all(record["type"] == "SHELTER" for record in result["facilities"])
    assert all(record["sourceReportedStatus"] is None for record in result["facilities"])
    assert all(record["sourceDate"] == "2024-09-11" for record in result["facilities"])
    assert result["source"]["version"] == "20240911"
    report = result["report"]
    assert report["excludedByReason"] == {
        "not_shelter_structure": 4, "missing_coordinates": 1, "outside_candidate_bounds": 1,
    }
    assert report["included"] + report["excluded"] == len(rows)
    assert {record["row"] for record in report["sourceRecords"]} == {2, 3, 4}
    assert report["sourceRecords"][0]["attributes"]["벤치개수"] == "5"


@pytest.mark.parametrize("longitude,latitude", [
    ("", ""), ("", 37.7), (127, ""), (" \t ", "  "),
])
def test_missing_coordinates_take_priority_over_facility_name(tmp_path, longitude, latitude):
    result = preprocess(structures(tmp_path, [
        ("정상 쉼터", "입구", 127.01, 37.7, ""),
        ("벤치", "쉼터 옆", longitude, latitude, 1),
        ("", "종류 불명", longitude, latitude, ""),
    ]))
    assert [record["name"] for record in result["facilities"]] == ["정상 쉼터"]
    report = result["report"]
    assert report["excludedByReason"] == {"missing_coordinates": 2}
    assert all(record["reason"] == "missing_coordinates" for record in report["rejectedRecords"])
    assert report["selected"] == 1
    assert report["included"] + report["excluded"] == 3


@pytest.mark.parametrize("longitude,latitude,reason", [
    ("", 37.7, "missing_coordinates"), (127, "", "missing_coordinates"),
    ("NaN", 37.7, "invalid_coordinates"), (127, "inf", "invalid_coordinates"),
    ("unknown", 37.7, "invalid_coordinates"), (37.7, 127, "invalid_coordinates"),
    (181, 37.7, "invalid_coordinates"), (127, 91, "invalid_coordinates"),
    (0, 0, "outside_candidate_bounds"), (126.89, 37.7, "outside_candidate_bounds"),
])
def test_invalid_coordinates_are_never_inferred_or_swapped(tmp_path, longitude, latitude, reason):
    result = preprocess(structures(tmp_path, [
        ("정상 쉼터", "입구", 127.01, 37.7, ""),
        ("오류 쉼터", "우이령", longitude, latitude, ""),
    ]))
    assert [record["name"] for record in result["facilities"]] == ["정상 쉼터"]
    assert result["report"]["excludedByReason"] == {reason: 1}


def test_boundary_coordinates_are_preserved(tmp_path):
    result = preprocess(structures(tmp_path, [
        ("서남 쉼터", "경계", 126.90, 37.59, ""),
        ("동북 쉼터", "경계", 127.07, 37.75, ""),
    ]))
    assert {(record["longitude"], record["latitude"]) for record in result["facilities"]} == {
        (126.90, 37.59), (127.07, 37.75),
    }


def test_stable_identity_and_distinct_facilities_at_same_coordinate(tmp_path):
    a = ("송추파고라", "입구", 126.99, 37.71, 5)
    b = ("송추파고라", "분소", 126.99, 37.71, "")
    first = preprocess(structures(tmp_path, [a, b]))["facilities"]
    second = preprocess(structures(tmp_path, [b, a]))["facilities"]
    assert first == second
    assert len(first) == 2
    original = preprocess(structures(tmp_path, [a]))["facilities"][0]
    moved = preprocess(structures(tmp_path, [
        (" 송추파고라  ", " 입구 ", 127.00, 37.71, 5),
    ]))["facilities"][0]
    assert original["sourceRecordId"] == moved["sourceRecordId"]
    assert original["longitude"] != moved["longitude"]


def test_exact_duplicates_skip_but_conflicting_coordinates_fail(tmp_path):
    row = ("송추파고라", "입구", 126.99, 37.71, 5)
    result = preprocess(structures(tmp_path, [row, row]))
    assert len(result["facilities"]) == 1
    assert len(result["report"]["sourceRecords"]) == 2
    assert result["report"]["excludedByReason"] == {"duplicate_source_record_id": 1}
    with pytest.raises(ValueError, match="conflicting_duplicate_source_record_id"):
        preprocess(structures(tmp_path, [row, ("송추파고라", "입구", 127.00, 37.71, 5)]))


@pytest.mark.parametrize("content,reason", [
    ("시설물명칭,X좌표,Y좌표\n쉼터,127,37.7\n", "required_fields_missing"),
    ("시설물명칭,상대위치,X좌표,Y좌표,X좌표\n", "required_fields_missing_or_duplicated"),
    ("시설물명칭,상대위치,X좌표,Y좌표\n쉼터,입구,127\n", "malformed_csv_row: 2"),
    ("시설물명칭,상대위치,X좌표,Y좌표\n쉼터,입구,127,37.7,extra\n", "malformed_csv_row: 2"),
])
def test_malformed_csv_fails(tmp_path, content, reason):
    path = tmp_path / "broken.csv"
    path.write_text(content, encoding="cp949")
    with pytest.raises(ValueError, match=reason):
        preprocess(path)


def test_empty_result_and_invalid_source_date_fail(tmp_path):
    path = structures(tmp_path, [("의자", "쉼터", 127, 37.7, 1)])
    with pytest.raises(ValueError, match="no_valid_selected_records"):
        preprocess(path)
    with pytest.raises(ValueError):
        preprocess(path, source_date="2024-99-99")


def test_cli_utf8_snapshot_date_and_overwrite_protection(tmp_path, monkeypatch, capsys):
    path = structures(tmp_path, [("쉼터", "입구", 127, 37.7, 8)], encoding="utf-8-sig")
    output = tmp_path / "output.json"
    args = ["shelters", str(path), str(output), "--encoding", "utf-8-sig",
            "--source-date", "2025-01-02"]
    monkeypatch.setattr(sys, "argv", args)
    main()
    assert json.loads(capsys.readouterr().out)["included"] == 1
    document = json.loads(output.read_text(encoding="utf-8"))
    assert document["facilities"][0]["sourceDate"] == "2025-01-02"
    assert document["source"]["version"] == "20250102"
    before = output.read_bytes()
    with pytest.raises(SystemExit) as error:
        main()
    assert error.value.code == 1
    assert output.read_bytes() == before
    monkeypatch.setattr(sys, "argv", args + ["--overwrite"])
    main()
    assert output.read_bytes() == before
    monkeypatch.setattr(sys, "argv", ["shelters", str(path), str(path), "--overwrite"])
    original = path.read_bytes()
    with pytest.raises(SystemExit) as error:
        main()
    assert error.value.code == 2
    assert path.read_bytes() == original
