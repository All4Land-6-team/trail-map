"""DEM 검사와 분석용 GeoTIFF 최적화 테스트."""

import os
import stat
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from trail_map_data.cli import main
from trail_map_data.dem import DemValidationError, inspect_dem, optimize_dem


AUTHORITY_LESS_CRS = """PROJCS["Transverse_Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",38],PARAMETER["central_meridian",127],PARAMETER["scale_factor",1],PARAMETER["false_easting",200000],PARAMETER["false_northing",600000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH]]"""


@pytest.fixture
def sample_dem(tmp_path: Path) -> tuple[Path, np.ndarray]:
    path = tmp_path / "sample.tif"
    values = np.arange(64 * 64, dtype=np.float32).reshape(64, 64)
    values[0, 0] = -9999.0

    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=64,
        height=64,
        count=1,
        dtype="float32",
        crs="EPSG:5186",
        transform=from_origin(200_000, 600_000, 1, 1),
        nodata=-9999.0,
    ) as dataset:
        dataset.write(values, 1)
        dataset.update_tags(SOURCE="synthetic-test")
        dataset.update_tags(1, UNIT_KIND="elevation")
        dataset.set_band_description(1, "테스트 고도")
        dataset.set_band_unit(1, "m")

    return path, values


def test_inspect_dem_reports_spatial_and_elevation_metadata(
    sample_dem: tuple[Path, np.ndarray],
) -> None:
    path, values = sample_dem

    metadata = inspect_dem(path, expected_crs="EPSG:5186")

    assert metadata["width"] == 64
    assert metadata["height"] == 64
    assert metadata["band_count"] == 1
    assert metadata["nodata"] == -9999.0
    assert metadata["resolution"] == {"x": 1.0, "y": 1.0}
    assert metadata["crs"]["authority"] == "EPSG:5186"
    assert metadata["crs"]["matches_expected"] is True
    assert metadata["elevation"]["minimum"] == float(values[0, 1])
    assert metadata["elevation"]["maximum"] == float(values.max())
    assert metadata["elevation"]["valid_pixel_count"] == values.size - 1


def test_optimize_dem_preserves_values_and_adds_storage_optimizations(
    sample_dem: tuple[Path, np.ndarray], tmp_path: Path
) -> None:
    source, source_values = sample_dem
    output = tmp_path / "optimized.tif"

    metadata = optimize_dem(
        source,
        output,
        expected_crs="EPSG:5186",
        require_crs_match=True,
        block_size=32,
    )

    with rasterio.open(output) as dataset:
        output_values = dataset.read(1)
        assert dataset.crs.to_epsg() == 5186
        assert dataset.transform == from_origin(200_000, 600_000, 1, 1)
        assert dataset.nodata == -9999.0
        assert dataset.profile["tiled"] is True
        assert dataset.compression.value == "DEFLATE"
        assert dataset.block_shapes == [(32, 32)]
        assert dataset.overviews(1) == [2, 4, 8, 16]
        assert dataset.tags(ns="IMAGE_STRUCTURE")["PREDICTOR"] == "3"
        assert dataset.tags()["SOURCE"] == "synthetic-test"
        assert dataset.tags(1)["UNIT_KIND"] == "elevation"
        assert dataset.descriptions[0] == "테스트 고도"
        assert dataset.units[0] == "m"

    np.testing.assert_array_equal(output_values, source_values)
    assert stat.S_IMODE(output.stat().st_mode) == stat.S_IMODE(source.stat().st_mode) & 0o666
    assert metadata["elevation"]["valid_pixel_count"] == source_values.size - 1
    assert metadata["storage"]["block_shapes"] == [[32, 32]]


def test_optimize_dem_rejects_unverified_crs(
    sample_dem: tuple[Path, np.ndarray], tmp_path: Path
) -> None:
    source, _ = sample_dem

    with pytest.raises(DemValidationError, match="예상 좌표계"):
        optimize_dem(
            source,
            tmp_path / "optimized.tif",
            expected_crs="EPSG:4326",
            require_crs_match=True,
        )


def test_optimize_dem_requires_expected_crs_for_strict_validation(
    sample_dem: tuple[Path, np.ndarray], tmp_path: Path
) -> None:
    source, _ = sample_dem

    with pytest.raises(DemValidationError, match="expected_crs"):
        optimize_dem(
            source,
            tmp_path / "optimized.tif",
            require_crs_match=True,
        )


def test_optimize_dem_does_not_overwrite_by_default(
    sample_dem: tuple[Path, np.ndarray], tmp_path: Path
) -> None:
    source, _ = sample_dem
    output = tmp_path / "optimized.tif"
    output.touch()

    with pytest.raises(FileExistsError):
        optimize_dem(source, output)


def test_optimize_dem_preserves_authority_less_crs(
    tmp_path: Path,
) -> None:
    source = tmp_path / "authority-less.tif"
    output = tmp_path / "optimized.tif"
    values = np.arange(32 * 32, dtype=np.float32).reshape(32, 32)
    with rasterio.open(
        source,
        "w",
        driver="GTiff",
        width=32,
        height=32,
        count=1,
        dtype="float32",
        crs=AUTHORITY_LESS_CRS,
        transform=from_origin(193_400, 572_422, 1, 1),
        nodata=-9999.0,
    ) as dataset:
        dataset.write(values, 1)

    metadata = optimize_dem(source, output, expected_crs="EPSG:5186")

    with rasterio.open(source) as source_dataset, rasterio.open(output) as output_dataset:
        assert output_dataset.crs == source_dataset.crs
        assert output_dataset.crs.to_epsg() is None
    assert metadata["crs"]["matches_expected"] is False


def test_optimize_dem_keeps_raced_destination_and_cleans_temporary_file(
    sample_dem: tuple[Path, np.ndarray], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source, _ = sample_dem
    output = tmp_path / "optimized.tif"
    original_link = os.link

    def create_destination_before_link(source_path: Path, destination_path: Path) -> None:
        Path(destination_path).write_text("other process", encoding="utf-8")
        original_link(source_path, destination_path)

    monkeypatch.setattr("trail_map_data.dem.os.link", create_destination_before_link)

    with pytest.raises(FileExistsError):
        optimize_dem(source, output)

    assert output.read_text(encoding="utf-8") == "other process"
    assert [path for path in tmp_path.iterdir() if path.name.startswith(".optimized.")] == []


def test_optimize_dem_overwrites_when_requested(
    sample_dem: tuple[Path, np.ndarray], tmp_path: Path
) -> None:
    source, source_values = sample_dem
    output = tmp_path / "optimized.tif"
    output.write_text("old output", encoding="utf-8")

    optimize_dem(source, output, overwrite=True)

    with rasterio.open(output) as dataset:
        np.testing.assert_array_equal(dataset.read(1), source_values)


def test_optimize_dem_rejects_invalid_expected_crs_before_publishing(
    sample_dem: tuple[Path, np.ndarray], tmp_path: Path
) -> None:
    source, _ = sample_dem
    output = tmp_path / "optimized.tif"

    with pytest.raises(DemValidationError, match="올바르지 않은"):
        optimize_dem(source, output, expected_crs="not-a-crs")

    assert not output.exists()
    assert list(tmp_path.glob("*.partial.tif")) == []


@pytest.mark.parametrize("command", ["inspect", "optimize-input", "optimize-output"])
def test_cli_rejects_metadata_path_collisions(
    sample_dem: tuple[Path, np.ndarray], tmp_path: Path, command: str
) -> None:
    source, _ = sample_dem
    output = tmp_path / "optimized.tif"

    if command == "inspect":
        arguments = ["dem", "inspect", str(source), "--output", str(source)]
    else:
        metadata_output = source if command == "optimize-input" else output
        arguments = [
            "dem",
            "optimize",
            str(source),
            str(output),
            "--metadata-output",
            str(metadata_output),
        ]

    with pytest.raises(DemValidationError, match="메타데이터 경로"):
        main(arguments)

    assert source.exists()
    assert not output.exists()


def test_cli_rejects_hard_linked_metadata_alias(
    sample_dem: tuple[Path, np.ndarray], tmp_path: Path
) -> None:
    source, _ = sample_dem
    metadata_alias = tmp_path / "metadata.json"
    os.link(source, metadata_alias)

    with pytest.raises(DemValidationError, match="메타데이터 경로"):
        main(["dem", "inspect", str(source), "--output", str(metadata_alias)])

    with rasterio.open(source) as dataset:
        assert dataset.width == 64


def test_optimize_dem_preserves_dataset_mask(tmp_path: Path) -> None:
    source = tmp_path / "masked.tif"
    output = tmp_path / "optimized.tif"
    values = np.arange(32 * 32, dtype=np.float32).reshape(32, 32)
    mask = np.full((32, 32), 255, dtype=np.uint8)
    mask[0:4, 0:4] = 0
    with rasterio.open(
        source,
        "w",
        driver="GTiff",
        width=32,
        height=32,
        count=1,
        dtype="float32",
        crs="EPSG:5186",
        transform=from_origin(200_000, 600_000, 1, 1),
    ) as dataset:
        dataset.write(values, 1)
        dataset.write_mask(mask)

    metadata = optimize_dem(source, output)

    with rasterio.open(output) as dataset:
        np.testing.assert_array_equal(dataset.dataset_mask(), mask)
    assert metadata["elevation"]["valid_pixel_count"] == values.size - 16


def test_cli_serializes_non_finite_metadata_as_null(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = tmp_path / "nan-nodata.tif"
    values = np.ones((16, 16), dtype=np.float32)
    with rasterio.open(
        source,
        "w",
        driver="GTiff",
        width=16,
        height=16,
        count=1,
        dtype="float32",
        crs="EPSG:5186",
        transform=from_origin(200_000, 600_000, 1, 1),
        nodata=np.nan,
    ) as dataset:
        dataset.write(values, 1)

    main(["dem", "inspect", str(source)])

    assert '"nodata": null' in capsys.readouterr().out

