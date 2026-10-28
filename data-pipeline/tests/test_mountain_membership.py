import copy
import os

import psycopg
import pytest

from trail_map_data.facilities.mountain_membership import classify, preprocess


def candidate(points=None):
    if points is None:
        points = [(1, 1), (5, 5), (0, 1), (3, 3), (2, 3)]
    return {
        "schemaVersion": 1,
        "source": {"name": "test-source", "provider": "test", "url": None,
                   "format": "TEST", "crs": "EPSG:4326", "version": "1"},
        "report": {"included": len(points)},
        "facilities": [
            {"sourceRecordId": str(i), "type": "RESTROOM", "longitude": x, "latitude": y}
            for i, (x, y) in enumerate(points)
        ],
    }


@pytest.fixture
def database():
    if os.environ.get("FACILITY_TEST_DATABASE") != "1":
        pytest.skip("Set FACILITY_TEST_DATABASE=1 and PG* for local PostGIS integration tests")
    with psycopg.connect(autocommit=True, connect_timeout=5) as connection:
        # 세션 전용 임시 테이블. 실제 산·시설 행에는 쓰지 않는다.
        connection.execute("""CREATE TEMP TABLE mountain (
            mountain_id bigint PRIMARY KEY, mountain_boundary geometry(MultiPolygon,4326))""")
        connection.execute("""CREATE TEMP TABLE data_source (
            source_id bigint PRIMARY KEY, source_name text, provider_name text,
            source_url text, source_format text, source_crs text, source_version text)""")
        connection.execute("""CREATE TEMP TABLE facility (
            source_id bigint, source_record_id text, mountain_id bigint)""")
        connection.execute("INSERT INTO pg_temp.mountain VALUES (2, NULL)")
        yield connection


def set_boundary(database, wkt, mountain_id=2):
    database.execute("UPDATE pg_temp.mountain SET mountain_boundary = ST_GeomFromText(%s,4326) WHERE mountain_id=%s",
                     (wkt, mountain_id))


def test_only_single_mountain_matches_are_retained(database):
    set_boundary(database, "MULTIPOLYGON(((0 0,4 0,4 4,0 4,0 0),(2 2,2 3.5,3.5 3.5,3.5 2,2 2)))")
    document = candidate()
    untouched = copy.deepcopy(document)
    result = classify(document, database)
    assert document == untouched
    assert [r["sourceRecordId"] for r in result["facilities"]] == ["0", "2", "4"]
    assert [r["mountainId"] for r in result["facilities"]] == [2, 2, 2]
    report = result["report"]["mountainMembership"]
    assert report["counts"] == {"inside": 1, "onBoundary": 2, "outside": 2,
                                "multipleMatches": 0, "existing": 0}
    assert report["included"] == 3
    assert [item["reason"] for item in report["excludedRecords"]] == ["outside", "outside"]


def test_uses_matched_mountain_id_without_default_two(database):
    database.execute("INSERT INTO pg_temp.mountain VALUES (7, ST_Multi(ST_MakeEnvelope(9,9,11,11,4326)))")
    result = classify(candidate([(10, 10)]), database)
    assert result["facilities"][0]["mountainId"] == 7


def test_multiple_boundaries_skip_ambiguous_candidate(database):
    set_boundary(database, "MULTIPOLYGON(((0 0,4 0,4 4,0 4,0 0)))")
    database.execute("INSERT INTO pg_temp.mountain VALUES (7, ST_Multi(ST_MakeEnvelope(0,0,2,2,4326)))")
    result = classify(candidate([(1, 1), (3, 3)]), database)
    assert [r["mountainId"] for r in result["facilities"]] == [2]
    assert result["report"]["mountainMembership"]["counts"]["multipleMatches"] == 1


def test_unset_boundaries_skip_without_assigning_default(database):
    result = classify(candidate(), database)
    assert result["facilities"] == []
    assert result["report"]["mountainMembership"]["counts"]["outside"] == 5


def test_empty_candidate_produces_empty_import_document(database):
    result = classify(candidate([]), database)
    assert result["schemaVersion"] == 2
    assert result["facilities"] == []
    assert result["report"]["mountainMembership"]["total"] == 0


def test_existing_source_record_is_not_reclassified(database):
    set_boundary(database, "MULTIPOLYGON(((0 0,4 0,4 4,0 4,0 0)))")
    database.execute("INSERT INTO pg_temp.data_source VALUES (4,'test-source','test',NULL,'TEST','EPSG:4326','1')")
    database.execute("INSERT INTO pg_temp.facility VALUES (4,'0',99)")
    result = classify(candidate([(1, 1), (2, 2)]), database)
    assert [r["sourceRecordId"] for r in result["facilities"]] == ["1"]
    assert result["report"]["mountainMembership"]["counts"]["existing"] == 1
    assert database.execute("SELECT mountain_id FROM pg_temp.facility WHERE source_record_id='0'").fetchone()[0] == 99


def test_changed_source_metadata_fails(database):
    database.execute("INSERT INTO pg_temp.data_source VALUES (4,'test-source','test','different','TEST','EPSG:4326','1')")
    with pytest.raises(ValueError, match="source_metadata_changed"):
        classify(candidate(), database)


@pytest.mark.parametrize("geometry", [
    "MULTIPOLYGON EMPTY",
    "MULTIPOLYGON(((0 0,2 2,0 2,2 0,0 0)))",
])
def test_invalid_boundary_fails(database, geometry):
    set_boundary(database, geometry)
    with pytest.raises(ValueError, match="invalid_mountain_boundary"):
        classify(candidate(), database)


def test_connection_failure_does_not_expose_private_details(monkeypatch):
    def fail(**kwargs):
        raise psycopg.OperationalError("private connection information")
    monkeypatch.setattr(psycopg, "connect", fail)
    with pytest.raises(ValueError, match="mountain_database_error") as failure:
        preprocess(candidate())
    assert "private" not in str(failure.value)


def test_invalid_point_duplicate_and_source_fail_before_database_access():
    document = candidate()
    document["facilities"][0]["longitude"] = 181
    with pytest.raises(ValueError, match="invalid_coordinates"):
        classify(document, None)
    document = candidate()
    document["facilities"].append(document["facilities"][0])
    with pytest.raises(ValueError, match="duplicate_source_record_id"):
        classify(document, None)
    document = candidate()
    del document["source"]["name"]
    with pytest.raises(ValueError, match="invalid_candidate_source"):
        classify(document, None)
