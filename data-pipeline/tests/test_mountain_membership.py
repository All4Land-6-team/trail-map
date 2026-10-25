import copy
import os

import psycopg
import pytest

from trail_map_data.facilities.mountain_membership import classify, preprocess


def candidate():
    return {
        "schemaVersion": 1, "source": {"name": "test"}, "report": {"included": 5},
        "facilities": [
            {"sourceRecordId": str(i), "type": "RESTROOM", "longitude": x, "latitude": y}
            for i, (x, y) in enumerate([(1, 1), (5, 5), (0, 1), (3, 3), (2, 3)])
        ],
    }


@pytest.fixture
def database():
    if os.environ.get("FACILITY_TEST_DATABASE") != "1":
        pytest.skip("Set FACILITY_TEST_DATABASE=1 and PG* for local PostGIS integration tests")
    with psycopg.connect(autocommit=True, connect_timeout=5) as connection:
        # 세션 전용 임시 테이블로 실제 mountain/facility에는 쓰지 않는다.
        connection.execute("""CREATE TEMP TABLE mountain (
            mountain_id bigint PRIMARY KEY, mountain_name text,
            mountain_boundary geometry(MultiPolygon,4326))""")
        connection.execute("INSERT INTO pg_temp.mountain VALUES (2, 'fixture', NULL)")
        yield connection


def test_covers_inside_outside_outer_and_hole_boundaries(database):
    database.execute("""UPDATE pg_temp.mountain SET mountain_boundary =
        ST_GeomFromText('MULTIPOLYGON(((0 0,4 0,4 4,0 4,0 0),(2 2,2 3.5,3.5 3.5,3.5 2,2 2)))',4326)""")
    document = candidate()
    untouched = copy.deepcopy(document)
    result = classify(document, database)
    assert document == untouched
    assert [r["mountainId"] for r in result["facilities"]] == [2, None, 2, None, 2]
    report = result["report"]["mountainMembership"]
    assert report["counts"] == {"inside": 1, "onBoundary": 2, "outside": 2, "boundaryUnset": 0}
    assert report["boundaryConfigured"] is True
    assert report["boundaryFingerprint"]
    assert len(result["facilities"]) == 5
    assert classify(result, database) == result


def test_null_boundary_is_assignment_not_spatial_confirmation(database):
    result = classify(candidate(), database)
    assert result["schemaVersion"] == 2
    assert all(r["mountainId"] == 2 for r in result["facilities"])
    report = result["report"]["mountainMembership"]
    assert report["counts"] == {"inside": 0, "onBoundary": 0, "outside": 0, "boundaryUnset": 5}
    assert report["boundaryConfigured"] is False
    assert report["boundaryFingerprint"] is None


def test_missing_mountain_is_not_null_boundary(database):
    with pytest.raises(ValueError, match="mountain_not_found"):
        classify(candidate(), database, mountain_id=99999999)


def test_new_boundary_reclassifies_previous_assignment(database):
    before = classify(candidate(), database)
    database.execute("""UPDATE pg_temp.mountain SET mountain_boundary =
        ST_Multi(ST_MakeEnvelope(0,0,2,2,4326))""")
    after = classify(before, database)
    assert before["facilities"][1]["mountainId"] == 2
    assert after["facilities"][1]["mountainId"] is None
    assert len(before["facilities"]) == len(after["facilities"])


def test_all_outside_records_are_retained_for_clearing_membership(database):
    database.execute("""UPDATE pg_temp.mountain SET mountain_boundary =
        ST_Multi(ST_MakeEnvelope(20,20,21,21,4326))""")
    result = classify(candidate(), database)
    assert len(result["facilities"]) == 5
    assert all(record["mountainId"] is None for record in result["facilities"])
    assert result["report"]["mountainMembership"]["counts"]["outside"] == 5


@pytest.mark.parametrize("geometry", [
    "MULTIPOLYGON EMPTY",
    "MULTIPOLYGON(((0 0,2 2,0 2,2 0,0 0)))",
])
def test_invalid_boundary_does_not_fall_back(database, geometry):
    database.execute("UPDATE pg_temp.mountain SET mountain_boundary = ST_GeomFromText(%s,4326)", (geometry,))
    with pytest.raises(ValueError, match="invalid_mountain_boundary"):
        classify(candidate(), database)


def test_connection_failure_is_not_null_boundary(monkeypatch):
    def fail(**kwargs):
        raise psycopg.OperationalError("private connection information")
    monkeypatch.setattr(psycopg, "connect", fail)
    with pytest.raises(ValueError, match="mountain_database_error") as failure:
        preprocess(candidate())
    assert "private" not in str(failure.value)


@pytest.mark.parametrize("mountain_id", [None, 0, -1, True, "2"])
def test_invalid_target_fails_before_database_access(mountain_id):
    with pytest.raises(ValueError, match="invalid_mountain_id"):
        classify(candidate(), None, mountain_id=mountain_id)


def test_invalid_point_and_duplicate_ids_fail_before_database_access():
    document = candidate()
    document["facilities"][0]["longitude"] = 181
    with pytest.raises(ValueError, match="invalid_coordinates"):
        classify(document, None)
    document = candidate()
    document["facilities"].append(document["facilities"][0])
    with pytest.raises(ValueError, match="duplicate_source_record_id"):
        classify(document, None)
