"""Terrain-RGB 인코딩과 XYZ 타일 생성 테스트."""

import json
import os
from pathlib import Path

import numpy as np
import pytest
import rasterio
from PIL import Image
from rasterio.transform import from_bounds

from trail_map_data.cli import main
from trail_map_data.dem import DemValidationError
from trail_map_data.terrain import (
    decode_terrain_rgb,
    encode_terrain_rgb,
    generate_terrain_tiles,
    tiles_for_bounds,
)


@pytest.fixture
def geographic_dem(tmp_path: Path) -> Path:
    path = tmp_path / "dem.tif"
    values = np.linspace(100.0, 800.0, 64 * 64, dtype=np.float32).reshape(64, 64)
    values[0, 0] = -9999.0
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=64,
        height=64,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=from_bounds(126.95, 37.65, 126.96, 37.66, 64, 64),
        nodata=-9999.0,
    ) as dataset:
        dataset.write(values, 1)
    return path


def test_terrain_rgb_round_trip_and_transparency() -> None:
    elevations = np.array([[-10_000.0, 0.0, 407.2, np.nan]], dtype=np.float32)

    rgba = encode_terrain_rgb(elevations)

    np.testing.assert_array_equal(rgba[0, 0], [0, 0, 0, 255])
    np.testing.assert_array_equal(rgba[0, 1], [1, 134, 160, 255])
    np.testing.assert_array_equal(rgba[0, 2], [1, 150, 136, 255])
    np.testing.assert_array_equal(rgba[0, 3], [0, 0, 0, 0])
    np.testing.assert_allclose(
        decode_terrain_rgb(rgba)[0, :3], elevations[0, :3], atol=0.05
    )


def test_terrain_rgb_rejects_out_of_range_elevation() -> None:
    with pytest.raises(DemValidationError, match="Terrain-RGB"):
        encode_terrain_rgb(np.array([[-10_000.1]], dtype=np.float32))


def test_tiles_for_bounds_uses_xyz_scheme() -> None:
    tiles = list(tiles_for_bounds((126.95, 37.65, 126.96, 37.66), zoom=14))

    assert [(tile.zoom, tile.x, tile.y) for tile in tiles] == [
        (14, 13969, 6339),
        (14, 13970, 6339),
    ]


def test_generate_terrain_tiles_writes_png_tiles_and_tilejson(
    geographic_dem: Path, tmp_path: Path
) -> None:
    output = tmp_path / "terrain"

    metadata = generate_terrain_tiles(
        geographic_dem,
        output,
        min_zoom=14,
        max_zoom=14,
        tiles_url="/api/v1/terrain/{z}/{x}/{y}.png",
    )

    tile_files = sorted((output / "tiles" / "14").glob("*/*.png"))
    tilejson = json.loads((output / "tilejson.json").read_text(encoding="utf-8"))
    maplibre_source = json.loads(
        (output / "maplibre-source.json").read_text(encoding="utf-8")
    )

    assert tile_files
    assert metadata["tile_count"] == len(tile_files)
    assert metadata["encoding"] == "mapbox"
    assert metadata["edge_feather_meters"] == 1_000.0
    assert tilejson["tilejson"] == "3.0.0"
    assert tilejson["scheme"] == "xyz"
    assert tilejson["tiles"] == ["/api/v1/terrain/{z}/{x}/{y}.png"]
    assert tilejson["minzoom"] == 14
    assert tilejson["maxzoom"] == 14
    assert tilejson["bounds"] == pytest.approx([126.95, 37.65, 126.96, 37.66])
    assert "tileSize" not in tilejson
    assert "encoding" not in tilejson
    assert maplibre_source["type"] == "raster-dem"
    assert maplibre_source["tileSize"] == 256
    assert maplibre_source["encoding"] == "mapbox"
    assert maplibre_source["tiles"] == ["/api/v1/terrain/{z}/{x}/{y}.png"]

    with Image.open(tile_files[0]) as image:
        assert image.mode == "RGBA"
        assert image.size == (256, 256)
        pixels = np.asarray(image)
        valid = pixels[..., 3] == 255
        assert valid.any()
        decoded = decode_terrain_rgb(pixels)
        assert float(decoded[valid].min()) == pytest.approx(0.0, abs=0.05)
        assert (decoded[valid] >= 99.9).any()
        assert float(decoded[valid].max()) <= 800.1


def test_generate_terrain_tiles_does_not_overwrite_by_default(
    geographic_dem: Path, tmp_path: Path
) -> None:
    output = tmp_path / "terrain"
    output.mkdir()
    (output / "keep.txt").write_text("keep", encoding="utf-8")

    with pytest.raises(FileExistsError):
        generate_terrain_tiles(geographic_dem, output, min_zoom=14, max_zoom=14)

    assert (output / "keep.txt").read_text(encoding="utf-8") == "keep"


@pytest.mark.parametrize("output_kind", ["source", "source-parent"])
def test_generate_terrain_tiles_rejects_output_that_contains_source(
    geographic_dem: Path, output_kind: str
) -> None:
    output = geographic_dem if output_kind == "source" else geographic_dem.parent

    with pytest.raises(DemValidationError, match="원본 DEM"):
        generate_terrain_tiles(
            geographic_dem,
            output,
            min_zoom=14,
            max_zoom=14,
            overwrite=True,
        )

    assert geographic_dem.is_file()


def test_generate_terrain_tiles_overwrites_existing_output(
    geographic_dem: Path, tmp_path: Path
) -> None:
    output = tmp_path / "terrain"
    output.mkdir()
    (output / "old.txt").write_text("old", encoding="utf-8")

    generate_terrain_tiles(
        geographic_dem, output, min_zoom=14, max_zoom=14, overwrite=True
    )

    assert not (output / "old.txt").exists()
    assert (output / "tilejson.json").is_file()


def test_generate_terrain_tiles_restores_output_when_publish_fails(
    geographic_dem: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    output = tmp_path / "terrain"
    output.mkdir()
    (output / "old.txt").write_text("old", encoding="utf-8")
    original_replace = os.replace
    replace_count = 0

    def fail_new_output_publish(source: Path, destination: Path) -> None:
        nonlocal replace_count
        replace_count += 1
        if replace_count == 2:
            raise OSError("publish failed")
        original_replace(source, destination)

    monkeypatch.setattr("trail_map_data.terrain.os.replace", fail_new_output_publish)

    with pytest.raises(OSError, match="publish failed"):
        generate_terrain_tiles(
            geographic_dem, output, min_zoom=14, max_zoom=14, overwrite=True
        )

    assert (output / "old.txt").read_text(encoding="utf-8") == "old"
    assert not list(tmp_path.glob(".terrain.*"))


def test_generate_terrain_tiles_validates_zoom_range(
    geographic_dem: Path, tmp_path: Path
) -> None:
    with pytest.raises(DemValidationError, match="줌"):
        generate_terrain_tiles(
            geographic_dem, tmp_path / "terrain", min_zoom=15, max_zoom=14
        )


def test_generate_terrain_tiles_enforces_configured_tile_limit(
    geographic_dem: Path, tmp_path: Path
) -> None:
    output = tmp_path / "terrain"

    with pytest.raises(DemValidationError, match=r"예상 타일 수\(2\)"):
        generate_terrain_tiles(
            geographic_dem,
            output,
            min_zoom=14,
            max_zoom=14,
            max_tiles=1,
        )

    assert not output.exists()


def test_generate_terrain_tiles_rejects_invalid_edge_feather(
    geographic_dem: Path, tmp_path: Path
) -> None:
    with pytest.raises(DemValidationError, match="외곽 완충 거리"):
        generate_terrain_tiles(
            geographic_dem,
            tmp_path / "terrain",
            min_zoom=14,
            max_zoom=14,
            edge_feather_meters=0,
        )


def test_generate_terrain_tiles_preserves_dataset_mask(tmp_path: Path) -> None:
    source = tmp_path / "masked.tif"
    output = tmp_path / "terrain"
    values = np.full((8, 8), 100.0, dtype=np.float32)
    mask = np.full((8, 8), 255, dtype=np.uint8)
    mask[3:5, 3:5] = 0
    with rasterio.open(
        source,
        "w",
        driver="GTiff",
        width=8,
        height=8,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=from_bounds(-180, -85.05112878, 180, 85.05112878, 8, 8),
    ) as dataset:
        dataset.write(values, 1)
        dataset.write_mask(mask)

    generate_terrain_tiles(source, output, min_zoom=0, max_zoom=0)

    with Image.open(output / "tiles" / "0" / "0" / "0.png") as image:
        pixels = np.asarray(image)
    assert (pixels[..., 3] == 255).all()
    np.testing.assert_allclose(decode_terrain_rgb(pixels), 100.0, atol=0.05)


def test_generate_terrain_tiles_rejects_dem_without_valid_elevation(
    tmp_path: Path,
) -> None:
    source = tmp_path / "empty.tif"
    output = tmp_path / "terrain"
    with rasterio.open(
        source,
        "w",
        driver="GTiff",
        width=16,
        height=16,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=from_bounds(126.95, 37.65, 126.96, 37.66, 16, 16),
        nodata=-9999.0,
    ) as dataset:
        dataset.write(np.full((16, 16), -9999.0, dtype=np.float32), 1)

    with pytest.raises(DemValidationError, match="유효한 고도"):
        generate_terrain_tiles(source, output, min_zoom=14, max_zoom=14)

    assert not output.exists()


def test_cli_generates_terrain_tiles(geographic_dem: Path, tmp_path: Path) -> None:
    output = tmp_path / "terrain"

    main(
        [
            "dem",
            "terrain-tiles",
            str(geographic_dem),
            str(output),
            "--min-zoom",
            "14",
            "--max-zoom",
            "14",
            "--max-tiles",
            "10",
        ]
    )

    assert (output / "tilejson.json").is_file()
    assert list((output / "tiles" / "14").glob("*/*.png"))
