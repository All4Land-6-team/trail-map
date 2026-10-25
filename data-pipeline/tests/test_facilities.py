import math

import pytest
import shapefile
from pyproj import CRS, Transformer

from trail_map_data.facilities.contract import normalize_facility
from trail_map_data.facilities.knps_restrooms import preprocess, write_document


def make_source(tmp_path, rows, crs="EPSG:4326", shape_type=shapefile.POINT):
    path = tmp_path / "restrooms.shp"
    with shapefile.Writer(str(path), shapeType=shape_type, encoding="cp949") as writer:
        writer.field("OBJECTID", "N", decimal=0)
        writer.field("PO_CD", "N", decimal=0)
        writer.field("KOR_NM", "C", size=100)
        writer.field("USE_YN", "N", decimal=0)
        for record_id, park, x, y in rows:
            if shape_type == shapefile.POINTZ:
                writer.pointz(x, y, 123)
            elif shape_type == shapefile.POINTM:
                writer.pointm(x, y, 456)
            else:
                writer.point(x, y)
            writer.record(record_id, park, "화장실", 1)
    path.with_suffix(".prj").write_text(CRS.from_user_input(crs).to_wkt(), encoding="utf-8")
    return path


def test_selection_exclusions_and_shared_coordinates(tmp_path):
    path = make_source(tmp_path, [
        (1, 1501, 126.98, 37.66), (2, 1501, 126.98, 37.66),
        (1, 1501, 126.98, 37.66), (3, 1501, 190, 37),
        (4, 201, 127, 36),
    ])
    result = preprocess(path, park_code="1501")
    assert [r["sourceRecordId"] for r in result["facilities"]] == ["1", "2"]
    assert result["facilities"][0]["name"] == "화장실"
    assert result["facilities"][0]["sourceReportedStatus"] == "USE_YN=1"
    assert result["report"]["excludedByReason"] == {
        "duplicate_source_record_id": 1, "invalid_coordinates": 1, "outside_park_code": 1,
    }
    assert result["report"]["totalRead"] == 5
    assert result["report"]["selected"] == 4
    assert result["report"]["included"] + result["report"]["excluded"] == 5


def test_projected_coordinates_are_transformed_in_longitude_latitude_order(tmp_path):
    x, y = Transformer.from_crs(4326, 5186, always_xy=True).transform(126.98, 37.66)
    result = preprocess(make_source(tmp_path, [(1, 1501, x, y)], "EPSG:5186"), park_code="1501")
    record = result["facilities"][0]
    assert record["longitude"] == pytest.approx(126.98)
    assert record["latitude"] == pytest.approx(37.66)


@pytest.mark.parametrize("shape_type", [shapefile.POINTZ, shapefile.POINTM])
def test_point_z_and_m_are_normalized_to_two_dimensions(tmp_path, shape_type):
    result = preprocess(make_source(tmp_path, [(1, 1501, 126.98, 37.66)], shape_type=shape_type), park_code="1501")
    assert result["facilities"][0]["longitude"] == pytest.approx(126.98)
    assert result["facilities"][0]["latitude"] == pytest.approx(37.66)


def test_missing_crs_and_conflicting_identity_fail(tmp_path):
    path = make_source(tmp_path, [(1, 1501, 127, 37), (1, 1501, 128, 37)])
    with pytest.raises(ValueError, match="conflicting_duplicate"):
        preprocess(path, park_code="1501")
    path.with_suffix(".prj").unlink()
    with pytest.raises(FileNotFoundError):
        preprocess(path, park_code="1501")


@pytest.mark.parametrize("overrides", [
    {"sourceRecordId": ""}, {"longitude": math.nan}, {"latitude": math.inf},
    {"latitude": 91}, {"longitude": None}, {"type": "PHOTO_SPOT"},
    {"sourceDate": "2014-99-99"},
])
def test_common_contract_rejects_bad_input(overrides):
    record = {"sourceRecordId": "1", "type": "RESTROOM", "longitude": 127, "latitude": 37}
    with pytest.raises(ValueError):
        normalize_facility(record | overrides)


def test_output_requires_explicit_overwrite(tmp_path):
    output = tmp_path / "import.json"
    write_document({"schemaVersion": 1}, output)
    with pytest.raises(FileExistsError):
        write_document({}, output)
    assert output.read_text(encoding="utf-8").strip() != "{}"
