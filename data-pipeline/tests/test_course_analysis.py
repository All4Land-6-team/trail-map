"""작은 해석적 DEM으로 거리·경사·결측 구간·저장 안전성을 검증한다."""

import hashlib
import json
import os
from datetime import datetime
from pathlib import Path

import numpy as np
import pytest
import rasterio
from affine import Affine
from rasterio.transform import from_origin
from rasterio.warp import transform

from trail_map_data.cli import main
from trail_map_data.course_analysis import (
    AnalysisConfig, CourseAnalysisError, analyze_course, analyze_course_to_file,
)

CUSTOM_CRS = "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +datum=WGS84 +units=m +no_defs"


@pytest.fixture
def files(tmp_path):
    """z = 100 + 2x + 3y, x/y는 테스트 격자 내 위치."""
    def make(points=None, *, unit="m", crs="EPSG:5186", values=None,
             affine=None, scale=1, offset=0, bom=False):
        dem = tmp_path / "테스트 DEM.tif"
        course = tmp_path / "코스 경로.geojson"
        size = 40
        if values is None:
            rows, cols = np.indices((size, size))
            values = (100 + 2 * (cols + 0.5) + 3 * (size - rows - 0.5)).astype("float32")
        affine = affine or from_origin(200_000, 600_040, 1, 1)
        with rasterio.open(dem, "w", driver="GTiff", width=size, height=size,
                           count=1, dtype=values.dtype, crs=crs, transform=affine,
                           nodata=-9999) as dataset:
            dataset.write(values, 1)
            if unit is not None:
                dataset.set_band_unit(1, unit)
            dataset.scales = (scale,)
            dataset.offsets = (offset,)
        points = points or [(4.5, 4.5), (14.5, 4.5)]
        # points는 왼쪽 아래를 원점으로 한 격자 위치다.
        xy = [(affine.a * x + affine.b * (size - y) + affine.c,
               affine.d * x + affine.e * (size - y) + affine.f) for x, y in points]
        lons, lats = transform(crs or "EPSG:5186", "EPSG:4326",
                               [p[0] for p in xy], [p[1] for p in xy])
        feature = {
            "type": "Feature", "properties": {
                "course_id": 1, "mountain_id": 1, "course_version": 3,
                "course_name": "계산 검증용 코스", "source_kind": "development",
            },
            "geometry": {"type": "LineString", "coordinates": list(map(list, zip(lons, lats)))},
        }
        course.write_text(json.dumps(feature, ensure_ascii=False),
                          encoding="utf-8-sig" if bom else "utf-8")
        return dem, course
    return make


def config(**kwargs):
    return AnalysisConfig(**{"sample_interval_meters": 4,
                             "vertical_reference": "synthetic-local-datum", **kwargs})


@pytest.mark.parametrize("method", ["nearest", "bilinear"])
def test_analytic_plane_distance_elevation_and_signed_grade(files, method):
    dem, course = files()
    result = analyze_course(dem, course, config=config(sampling_method=method))
    summary, profile = result["summary"], result["profile"]
    assert result["quality_status"] == "AVAILABLE"
    assert summary["distance_meters"] == pytest.approx(10, abs=1e-6)
    assert [p["distance_meters"] for p in profile] == pytest.approx([0, 4, 8, 10], abs=1e-6)
    assert [p["elevation_meters"] for p in profile] == pytest.approx([122.5, 130.5, 138.5, 142.5], abs=1e-6)
    assert profile[0]["slope_percent"] is None
    assert [p["slope_percent"] for p in profile[1:]] == pytest.approx([200, 200, 200], abs=1e-4)
    assert summary["elevation_gain_meters"] == pytest.approx(20, abs=1e-6)
    assert summary["elevation_loss_meters"] == 0
    assert summary["sample_coverage_percent"] == 100
    assert summary["distance_coverage_percent"] == pytest.approx(100)
    assert result["course"]["course_version"] == 3
    assert result["course"]["source_kind"] == "development"
    assert result["inputs"]["course"]["sha256"] == hashlib.sha256(course.read_bytes()).hexdigest()
    assert result["inputs"]["dem"]["sha256"] == hashlib.sha256(dem.read_bytes()).hexdigest()
    assert datetime.fromisoformat(result["calculated_at"]).utcoffset().total_seconds() == 0
    json.dumps(result, allow_nan=False)


def test_bilinear_interpolation_recovers_plane_between_pixel_centers(files):
    dem, course = files([(4.2, 4.3), (14.2, 4.3)])
    result = analyze_course(dem, course, config=config())
    assert result["profile"][0]["elevation_meters"] == pytest.approx(121.3, abs=1e-6)
    assert result["summary"]["elevation_gain_meters"] == pytest.approx(20, abs=1e-6)


def test_original_corner_and_endpoint_are_retained(files):
    dem, course = files([(4.5, 4.5), (10.5, 4.5), (10.5, 8.5)])
    result = analyze_course(dem, course, config=config(sample_interval_meters=4))
    assert [p["distance_meters"] for p in result["profile"]] == pytest.approx([0, 4, 6, 8, 10], abs=1e-6)
    assert result["summary"]["distance_meters"] == pytest.approx(10, abs=1e-6)
    assert result["summary"]["elevation_gain_meters"] == pytest.approx(24, abs=1e-6)


def test_ascent_descent_and_loop_keep_path_order(files):
    dem, course = files([(4.5, 4.5), (14.5, 4.5), (4.5, 4.5)])
    result = analyze_course(dem, course, config=config())
    assert result["summary"]["distance_meters"] == pytest.approx(20, abs=1e-6)
    assert result["summary"]["elevation_gain_meters"] == pytest.approx(20, abs=1e-6)
    assert result["summary"]["elevation_loss_meters"] == pytest.approx(20, abs=1e-6)
    assert result["profile"][-1]["slope_percent"] == pytest.approx(-200, abs=1e-4)


def test_consecutive_duplicate_coordinates_are_removed(files):
    dem, course = files([(4.5, 4.5), (4.5, 4.5), (14.5, 4.5)])
    result = analyze_course(dem, course, config=config())
    assert result["diagnostics"]["removed_consecutive_duplicate_count"] == 1
    assert result["summary"]["distance_meters"] == pytest.approx(10, abs=1e-6)


def test_flat_course_has_zero_gain_and_grade_not_missing(files):
    dem, course = files(values=np.full((40, 40), 50, dtype="float32"))
    result = analyze_course(dem, course, config=config())
    assert result["summary"]["elevation_gain_meters"] == 0
    assert result["summary"]["elevation_loss_meters"] == 0
    assert all(p["slope_percent"] == 0 for p in result["profile"][1:])


@pytest.mark.parametrize("missing, reason", [(-9999, "NODATA"), (float("nan"), "NON_FINITE"), (float("inf"), "NON_FINITE")])
def test_gap_is_not_bridged_or_converted_to_zero(files, missing, reason):
    values = np.tile(np.arange(40, dtype="float32") * 2, (40, 1))
    values[35, 6] = missing
    dem, course = files([(4.5, 4.5), (8.5, 4.5)], values=values)
    result = analyze_course(dem, course, config=config(sample_interval_meters=1))
    assert result["quality_status"] == "PARTIAL"
    assert result["profile"][2]["sample_status"] == reason
    assert result["profile"][2]["elevation_meters"] is None
    assert result["profile"][3]["slope_percent"] is None
    assert result["summary"]["elevation_gain_meters"] == pytest.approx(4, abs=1e-6)
    assert result["summary"]["covered_distance_meters"] == pytest.approx(2, abs=1e-6)
    assert result["summary"]["sample_coverage_percent"] == 80
    json.dumps(result, allow_nan=False)


def test_bilinear_requires_valid_nonzero_weight_neighbors(files):
    values = np.full((40, 40), 10, dtype="float32")
    values[35, 3] = -9999
    dem, course = files([(4, 4), (8, 4)], values=values)
    result = analyze_course(dem, course, config=config(sample_interval_meters=1))
    assert result["profile"][0]["sample_status"] == "NODATA"
    assert result["profile"][-1]["elevation_meters"] == 10


def test_zero_weight_nodata_neighbor_does_not_invalidate_pixel_center(files):
    values = np.full((40, 40), 10, dtype="float32")
    values[36, 4] = -9999
    dem, course = files(values=values)
    result = analyze_course(dem, course, config=config())
    assert result["profile"][0]["elevation_meters"] == 10


@pytest.mark.parametrize("kind", ["nodata", "outside"])
def test_no_data_is_explicit_and_gain_is_null(files, kind):
    if kind == "nodata":
        dem, course = files(values=np.full((40, 40), -9999, dtype="float32"))
    else:
        dem, course = files([(-10.5, 4.5), (-5.5, 4.5)])
    result = analyze_course(dem, course, config=config())
    assert result["quality_status"] == "NO_DATA"
    assert result["summary"]["sample_coverage_percent"] == 0
    assert result["summary"]["elevation_gain_meters"] is None
    assert result["summary"]["min_elevation_meters"] is None


def test_bilinear_edge_is_not_filled_silently(files):
    dem, course = files([(0.1, 4.5), (1.1, 4.5)])
    result = analyze_course(dem, course, config=config(sample_interval_meters=1))
    assert result["profile"][0]["sample_status"] == "INSUFFICIENT_NEIGHBORS"
    assert result["quality_status"] == "PARTIAL"
    assert result["summary"]["elevation_gain_meters"] is None


def test_unknown_band_unit_preserves_raw_height_but_not_metric_claims(files):
    dem, course = files(unit=None)
    result = analyze_course(dem, course, config=config())
    assert result["quality_status"] == "PARTIAL"
    assert "UNVERIFIED_ELEVATION_UNIT" in result["quality_reasons"]
    assert result["profile"][0]["elevation_source_value"] == pytest.approx(122.5, abs=1e-6)
    assert all(p["elevation_meters"] is None and p["slope_percent"] is None for p in result["profile"])
    assert result["summary"]["elevation_gain_meters"] is None
    assert result["summary"]["distance_meters"] == pytest.approx(10, abs=1e-6)


def test_explicit_unit_for_untagged_dem_records_caller_declaration(files):
    dem, course = files(unit=None)
    result = analyze_course(dem, course, config=config(elevation_unit="m"))
    assert result["quality_status"] == "AVAILABLE"
    assert result["settings"]["elevation_unit_source"] == "caller_declaration"


def test_unknown_vertical_reference_is_partial_even_when_units_are_known(files):
    dem, course = files()
    result = analyze_course(dem, course, config=config(vertical_reference="unknown"))
    assert result["settings"]["vertical_reference"] is None
    assert result["quality_status"] == "PARTIAL"
    assert "UNVERIFIED_VERTICAL_REFERENCE" in result["quality_reasons"]
    assert result["summary"]["elevation_gain_meters"] == pytest.approx(20, abs=1e-6)


def test_feet_height_conversion_is_independent_of_horizontal_crs(files):
    dem, course = files(unit="ft")
    result = analyze_course(dem, course, config=config())
    assert result["summary"]["distance_meters"] == pytest.approx(10, abs=1e-6)
    assert result["summary"]["elevation_gain_meters"] == pytest.approx(6.096, abs=1e-6)
    assert result["profile"][1]["slope_percent"] == pytest.approx(60.96, abs=1e-4)


def test_conflicting_vertical_units_are_rejected(files):
    dem, course = files(unit="ft")
    with pytest.raises(CourseAnalysisError, match="단위가 다릅니다"):
        analyze_course(dem, course, config=config(elevation_unit="m"))


def test_band_scale_and_offset_are_applied(files):
    dem, course = files(scale=2, offset=10)
    result = analyze_course(dem, course, config=config())
    assert result["profile"][0]["elevation_meters"] == pytest.approx(255, abs=1e-6)
    assert result["summary"]["elevation_gain_meters"] == pytest.approx(40, abs=1e-6)


def test_source_id_is_retained_for_later_database_integration(files):
    dem, course = files()
    document = json.loads(course.read_text(encoding="utf-8"))
    document["properties"]["source_id"] = 5
    course.write_text(json.dumps(document), encoding="utf-8")
    result = analyze_course(dem, course, config=config())
    assert result["course"]["source_id"] == 5


def test_complex_height_data_is_rejected(files):
    dem, course = files(values=np.full((40, 40), 1 + 2j, dtype="complex64"))
    with pytest.raises(CourseAnalysisError, match="실수"):
        analyze_course(dem, course, config=config())


def test_nonfinite_calculated_grade_cannot_replace_result(files, tmp_path):
    values = np.full((40, 40), 1e308, dtype="float64")
    values[:, 10:] = -1e308
    dem, course = files(values=values)
    output = tmp_path / "analysis.json"
    output.write_text("previous", encoding="utf-8")
    with pytest.raises(CourseAnalysisError, match="경사가 유한하지"):
        analyze_course_to_file(dem, course, output, config=config(), overwrite=True)
    assert output.read_text(encoding="utf-8") == "previous"


def test_authority_less_original_crs_is_retained(files):
    dem, course = files(crs=CUSTOM_CRS)
    with rasterio.open(dem) as ds:
        original_wkt = ds.crs.to_wkt()
        assert ds.crs.to_epsg() is None
    result = analyze_course(dem, course, config=config())
    assert result["inputs"]["dem"]["crs_wkt"] == original_wkt
    assert result["inputs"]["dem"]["crs_authority"] is None
    assert result["summary"]["distance_meters"] == pytest.approx(10, abs=1e-6)


def test_horizontal_survey_feet_are_converted_to_meters(files):
    dem, course = files(crs="EPSG:2263")
    result = analyze_course(dem, course, config=config(sample_interval_meters=1))
    assert result["summary"]["distance_meters"] == pytest.approx(10 * 1200 / 3937, abs=1e-4)


def test_rotated_raster_uses_inverse_pixel_transform(files):
    rotation = Affine.rotation(25)
    affine = Affine(rotation.a, rotation.b, 200_000, -rotation.d, -rotation.e, 600_040)
    dem, course = files(affine=affine)
    result = analyze_course(dem, course, config=config())
    assert result["summary"]["distance_meters"] == pytest.approx(10, abs=1e-6)
    assert result["summary"]["elevation_gain_meters"] == pytest.approx(20, abs=1e-6)


@pytest.mark.parametrize("crs", [None, "EPSG:4326"])
def test_missing_or_geographic_dem_crs_is_rejected(files, crs):
    # EPSG:4326 DEM에는 입력 코스가 무엇이든 거리 단위 검증이 먼저 적용된다.
    if crs is None:
        dem, course = files(crs=None)
    else:
        dem, course = files()
        with rasterio.open(dem, "r+") as ds:
            ds.crs = crs
    with pytest.raises(CourseAnalysisError, match="투영 좌표계"):
        analyze_course(dem, course, config=config())


@pytest.mark.parametrize("settings", [
    {"sample_interval_meters": 0}, {"sample_interval_meters": -1},
    {"sample_interval_meters": float("nan")}, {"sample_interval_meters": float("inf")},
    {"sample_interval_meters": True}, {"sample_interval_meters": 10 ** 400},
    {"max_samples": 1}, {"max_samples": True}, {"sampling_method": "cubic"},
    {"elevation_unit": "degrees"}, {"vertical_reference": " "},
])
def test_invalid_analysis_settings_are_rejected(settings):
    with pytest.raises(CourseAnalysisError):
        config(**settings)


def test_sample_count_is_bounded_before_allocation(files):
    dem, course = files()
    with pytest.raises(CourseAnalysisError, match="최대 샘플"):
        analyze_course(dem, course, config=config(sample_interval_meters=1e-12))


def test_duplicate_only_course_is_rejected(files):
    dem, course = files([(4.5, 4.5), (4.5, 4.5)])
    with pytest.raises(CourseAnalysisError, match="길이가 0"):
        analyze_course(dem, course, config=config())


@pytest.mark.parametrize("change", ["missing_id", "boolean_id", "invalid_coordinate", "nan_coordinate", "multiline", "collection", "legacy_crs", "invalid_source_kind"])
def test_invalid_geojson_fails_before_analysis(files, change):
    dem, course = files()
    document = json.loads(course.read_text(encoding="utf-8"))
    if change == "missing_id":
        del document["properties"]["course_version"]
    elif change == "boolean_id":
        document["properties"]["course_id"] = True
    elif change == "invalid_coordinate":
        document["geometry"]["coordinates"][0] = [200, 37]
    elif change == "nan_coordinate":
        document["geometry"]["coordinates"][0][0] = float("nan")
    elif change == "multiline":
        document["geometry"]["type"] = "MultiLineString"
    elif change == "collection":
        document = {"type": "FeatureCollection", "features": [document]}
    elif change == "legacy_crs":
        document["crs"] = {"type": "name", "properties": {"name": "EPSG:5186"}}
    elif change == "invalid_source_kind":
        document["properties"]["source_kind"] = []
    course.write_text(json.dumps(document), encoding="utf-8")
    with pytest.raises(CourseAnalysisError):
        analyze_course(dem, course, config=config())


def test_utf8_bom_and_unused_geojson_z_are_supported(files):
    dem, course = files(bom=True)
    document = json.loads(course.read_text(encoding="utf-8-sig"))
    for point in document["geometry"]["coordinates"]:
        point.append(9999)
    course.write_text(json.dumps(document), encoding="utf-8-sig")
    result = analyze_course(dem, course, config=config())
    assert result["profile"][0]["elevation_meters"] != 9999
    assert all(len(p) == 2 for p in result["course"]["geometry"]["coordinates"])


def test_cli_writes_valid_json_and_requires_explicit_overwrite(files, tmp_path, capsys):
    dem, course = files()
    output = tmp_path / "결과" / "analysis.json"
    args = ["course", "analyze", str(dem), str(course), "--sample-interval-meters", "4",
            "--vertical-reference", "synthetic-local-datum", "--output", str(output)]
    main(args)
    original = output.read_bytes()
    assert json.loads(original)["summary"]["elevation_gain_meters"] == pytest.approx(20, abs=1e-6)
    assert "quality_status=AVAILABLE" in capsys.readouterr().out
    with pytest.raises(SystemExit) as exc:
        main(args)
    assert exc.value.code == 2
    assert "이미 존재" in capsys.readouterr().err
    assert output.read_bytes() == original
    main([*args, "--overwrite"])


def test_cli_unverified_height_does_not_fabricate_meter_values(files, tmp_path):
    dem, course = files(unit=None)
    output = tmp_path / "analysis.json"
    main(["course", "analyze", str(dem), str(course), "--sample-interval-meters", "10",
          "--output", str(output)])
    result = json.loads(output.read_text(encoding="utf-8"))
    assert result["quality_status"] == "PARTIAL"
    assert result["summary"]["max_elevation_meters"] is None


def test_cli_invalid_interval_is_actionable_and_keeps_old_result(files, tmp_path, capsys):
    dem, course = files()
    output = tmp_path / "analysis.json"
    output.write_text("previous", encoding="utf-8")
    with pytest.raises(SystemExit) as exc:
        main(["course", "analyze", str(dem), str(course), "--sample-interval-meters", "0",
              "--output", str(output), "--overwrite"])
    assert exc.value.code == 2
    assert "샘플 간격" in capsys.readouterr().err
    assert output.read_text(encoding="utf-8") == "previous"


@pytest.mark.parametrize("target", ["dem", "course", "hardlink", "auxiliary"])
def test_output_never_overwrites_inputs(files, tmp_path, target):
    dem, course = files()
    output = dem if target == "dem" else course
    if target == "hardlink":
        output = tmp_path / "alias.json"
        os.link(dem, output)
    if target == "auxiliary":
        output = Path(str(dem) + ".aux.xml")
        output.write_text("auxiliary", encoding="utf-8")
    original = output.read_bytes()
    with pytest.raises(CourseAnalysisError, match="입력 파일"):
        analyze_course_to_file(dem, course, output, config=config(), overwrite=True)
    assert output.read_bytes() == original


def test_raced_output_is_preserved_and_temp_is_cleaned(files, tmp_path, monkeypatch):
    dem, course = files()
    output = tmp_path / "analysis.json"
    original_link = os.link

    def race(source, target):
        Path(target).write_text("other process", encoding="utf-8")
        original_link(source, target)

    monkeypatch.setattr("trail_map_data.course_analysis.os.link", race)
    with pytest.raises(FileExistsError):
        analyze_course_to_file(dem, course, output, config=config())
    assert output.read_text(encoding="utf-8") == "other process"
    assert not list(tmp_path.glob(".analysis.json.*.tmp"))


def test_changed_input_does_not_replace_previous_result(files, tmp_path, monkeypatch):
    from trail_map_data import course_analysis
    dem, course = files()
    output = tmp_path / "analysis.json"
    output.write_text("previous", encoding="utf-8")
    original_sample = course_analysis._sample
    changed = False

    def mutate(dataset, x, y, method):
        nonlocal changed
        if not changed:
            course.write_text(course.read_text(encoding="utf-8") + " ", encoding="utf-8")
            changed = True
        return original_sample(dataset, x, y, method)

    monkeypatch.setattr(course_analysis, "_sample", mutate)
    with pytest.raises(CourseAnalysisError, match="입력 파일이 변경"):
        analyze_course_to_file(dem, course, output, config=config(), overwrite=True)
    assert output.read_text(encoding="utf-8") == "previous"
