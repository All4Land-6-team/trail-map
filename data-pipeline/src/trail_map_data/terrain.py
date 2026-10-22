"""분석용 DEM을 MapLibre용 Terrain-RGB XYZ 타일로 변환한다."""

from __future__ import annotations

import json
import math
import os
import shutil
import tempfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.errors import RasterioIOError
from rasterio.fill import fillnodata
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds
from rasterio.windows import Window

from trail_map_data.dem import DemValidationError, paths_alias, validate_dem_dataset

TILE_SIZE = 256
WEB_MERCATOR_LIMIT = 20_037_508.342789244
MAX_WEB_MERCATOR_LATITUDE = 85.0511287798066
MIN_TERRAIN_RGB_ELEVATION = -10_000.0
MAX_TERRAIN_RGB_ELEVATION = 1_667_721.5
DEFAULT_EDGE_FEATHER_METERS = 1_000.0


@dataclass(frozen=True)
class Tile:
    """XYZ 타일 좌표."""

    zoom: int
    x: int
    y: int


def encode_terrain_rgb(elevations: np.ndarray) -> np.ndarray:
    """미터 단위 고도를 Mapbox Terrain-RGB RGBA 픽셀로 인코딩한다."""

    values = np.asarray(elevations, dtype=np.float64)
    valid = np.isfinite(values)
    if valid.any():
        minimum = float(values[valid].min())
        maximum = float(values[valid].max())
        if minimum < MIN_TERRAIN_RGB_ELEVATION or maximum > MAX_TERRAIN_RGB_ELEVATION:
            raise DemValidationError(
                "Terrain-RGB 표현 범위를 벗어난 고도가 있습니다: "
                f"minimum={minimum}, maximum={maximum}"
            )

    encoded = np.zeros(values.shape, dtype=np.uint32)
    encoded[valid] = np.floor(
        (values[valid] - MIN_TERRAIN_RGB_ELEVATION) * 10.0 + 0.5
    ).astype(np.uint32)

    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    rgba[..., 0] = (encoded >> 16) & 255
    rgba[..., 1] = (encoded >> 8) & 255
    rgba[..., 2] = encoded & 255
    rgba[..., 3] = np.where(valid, 255, 0).astype(np.uint8)
    return rgba


def decode_terrain_rgb(pixels: np.ndarray) -> np.ndarray:
    """테스트와 산출물 검증을 위해 Terrain-RGB 픽셀을 미터로 복원한다."""

    values = np.asarray(pixels)
    if values.ndim < 3 or values.shape[-1] not in (3, 4):
        raise DemValidationError("Terrain-RGB 픽셀은 RGB 또는 RGBA 배열이어야 합니다")

    rgb = values[..., :3].astype(np.uint32)
    encoded = (rgb[..., 0] << 16) + (rgb[..., 1] << 8) + rgb[..., 2]
    elevations = MIN_TERRAIN_RGB_ELEVATION + encoded.astype(np.float64) * 0.1
    if values.shape[-1] == 4:
        elevations = elevations.astype(np.float64)
        elevations[values[..., 3] == 0] = np.nan
    return elevations


def _longitude_to_x(longitude: float, zoom: int) -> int:
    count = 1 << zoom
    return min(count - 1, max(0, math.floor((longitude + 180.0) / 360.0 * count)))


def _latitude_to_y(latitude: float, zoom: int) -> int:
    count = 1 << zoom
    limited = min(MAX_WEB_MERCATOR_LATITUDE, max(-MAX_WEB_MERCATOR_LATITUDE, latitude))
    radians = math.radians(limited)
    value = (1.0 - math.asinh(math.tan(radians)) / math.pi) / 2.0 * count
    return min(count - 1, max(0, math.floor(value)))


def tiles_for_bounds(
    bounds: tuple[float, float, float, float], zoom: int
) -> Iterator[Tile]:
    """경위도 범위를 덮는 XYZ 타일 좌표를 반환한다."""

    west, south, east, north = bounds
    if zoom < 0 or zoom > 22:
        raise DemValidationError(f"지원하지 않는 줌 레벨입니다: {zoom}")
    if not (-180.0 <= west < east <= 180.0 and -90.0 <= south < north <= 90.0):
        raise DemValidationError(f"올바르지 않은 경위도 범위입니다: {bounds}")

    minimum_x, maximum_x, minimum_y, maximum_y = _tile_indices(bounds, zoom)
    for x in range(minimum_x, maximum_x + 1):
        for y in range(minimum_y, maximum_y + 1):
            yield Tile(zoom=zoom, x=x, y=y)


def _tile_indices(
    bounds: tuple[float, float, float, float], zoom: int
) -> tuple[int, int, int, int]:
    west, south, east, north = bounds
    minimum_x = _longitude_to_x(west, zoom)
    maximum_x = _longitude_to_x(math.nextafter(east, west), zoom)
    minimum_y = _latitude_to_y(math.nextafter(north, south), zoom)
    maximum_y = _latitude_to_y(south, zoom)
    return minimum_x, maximum_x, minimum_y, maximum_y


def _tile_bounds(tile: Tile) -> tuple[float, float, float, float]:
    count = 1 << tile.zoom
    span = WEB_MERCATOR_LIMIT * 2.0 / count
    left = -WEB_MERCATOR_LIMIT + tile.x * span
    right = left + span
    top = WEB_MERCATOR_LIMIT - tile.y * span
    bottom = top - span
    return left, bottom, right, top


def _render_tile(
    vrt: WarpedVRT,
    tile: Tile,
    minimum_x: int,
    minimum_y: int,
    dem_bounds: tuple[float, float, float, float],
    edge_feather_meters: float,
) -> np.ndarray | None:
    window = Window(
        (tile.x - minimum_x) * TILE_SIZE,
        (tile.y - minimum_y) * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
    )
    elevations = vrt.read(1, window=window, masked=True).filled(np.nan).astype(np.float64)
    valid = np.isfinite(elevations)
    if not valid.any():
        return None

    left, bottom, right, top = _tile_bounds(tile)
    pixel_size = (right - left) / TILE_SIZE
    x = left + (np.arange(TILE_SIZE) + 0.5) * pixel_size
    y = top - (np.arange(TILE_SIZE) + 0.5) * pixel_size
    dem_left, dem_bottom, dem_right, dem_top = dem_bounds
    x_edge_distance = np.minimum(x - dem_left, dem_right - x)
    y_edge_distance = np.minimum(y - dem_bottom, dem_top - y)
    edge_distance = np.minimum(y_edge_distance[:, None], x_edge_distance[None, :])
    inside_bounds = edge_distance > 0
    missing_inside = inside_bounds & ~valid

    if missing_inside.any():
        fill_source = np.where(inside_bounds, elevations, 0.0)
        fill_mask = (valid | ~inside_bounds).astype(np.uint8)
        filled = fillnodata(
            fill_source,
            mask=fill_mask,
            max_search_distance=TILE_SIZE * 2,
        )
        elevations = np.where(missing_inside, filled, elevations)

    feather = np.clip(edge_distance / edge_feather_meters, 0.0, 1.0)
    elevations = np.where(
        inside_bounds & np.isfinite(elevations),
        elevations * feather,
        0.0,
    )
    return encode_terrain_rgb(elevations)


def _zoom_vrt(
    source: rasterio.io.DatasetReader,
    zoom: int,
    indices: tuple[int, int, int, int],
) -> tuple[WarpedVRT, int, int]:
    minimum_x, maximum_x, minimum_y, maximum_y = indices
    left, _, _, top = _tile_bounds(Tile(zoom, minimum_x, minimum_y))
    _, bottom, right, _ = _tile_bounds(Tile(zoom, maximum_x, maximum_y))
    transform = from_bounds(
        left,
        bottom,
        right,
        top,
        (maximum_x - minimum_x + 1) * TILE_SIZE,
        (maximum_y - minimum_y + 1) * TILE_SIZE,
    )
    vrt = WarpedVRT(
        source,
        crs="EPSG:3857",
        transform=transform,
        width=(maximum_x - minimum_x + 1) * TILE_SIZE,
        height=(maximum_y - minimum_y + 1) * TILE_SIZE,
        resampling=Resampling.bilinear,
        nodata=np.nan,
    )
    return vrt, minimum_x, minimum_y


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(
        f"{json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)}\n",
        encoding="utf-8",
    )


def _publish_directory(staging: Path, output: Path, *, overwrite: bool) -> None:
    if not output.exists():
        os.replace(staging, output)
        return
    if not overwrite:
        raise FileExistsError(f"출력 디렉터리가 이미 존재합니다: {output}")

    backup = Path(tempfile.mkdtemp(prefix=f".{output.name}.backup.", dir=output.parent))
    backup.rmdir()
    os.replace(output, backup)
    try:
        os.replace(staging, output)
    except Exception:
        os.replace(backup, output)
        raise
    shutil.rmtree(backup)


def generate_terrain_tiles(
    source_path: str | Path,
    output_path: str | Path,
    *,
    min_zoom: int,
    max_zoom: int,
    tiles_url: str = "./tiles/{z}/{x}/{y}.png",
    max_tiles: int | None = None,
    edge_feather_meters: float = DEFAULT_EDGE_FEATHER_METERS,
    overwrite: bool = False,
) -> dict[str, Any]:
    """분석용 DEM에서 Terrain-RGB XYZ PNG 타일과 TileJSON을 생성한다."""

    source_path = Path(source_path)
    output_path = Path(output_path)
    source_resolved = source_path.resolve()
    output_resolved = output_path.resolve()
    if paths_alias(source_path, output_path) or output_resolved in source_resolved.parents:
        raise DemValidationError(
            "출력 디렉터리는 원본 DEM과 같거나 "
            "원본 DEM을 포함할 수 없습니다"
        )
    if min_zoom < 0 or max_zoom > 22 or min_zoom > max_zoom:
        raise DemValidationError(
            f"줌 범위는 0~22이며 최소 줌은 최대 줌보다 클 수 없습니다: "
            f"{min_zoom}~{max_zoom}"
        )
    if not all(token in tiles_url for token in ("{z}", "{x}", "{y}")):
        raise DemValidationError("타일 URL에는 {z}, {x}, {y} 토큰이 모두 필요합니다")
    if max_tiles is not None and max_tiles < 1:
        raise DemValidationError("최대 타일 수는 1 이상이어야 합니다")
    if not math.isfinite(edge_feather_meters) or edge_feather_meters <= 0:
        raise DemValidationError("외곽 완충 거리는 0보다 큰 유한한 값이어야 합니다")
    if output_path.exists() and not overwrite:
        raise FileExistsError(f"출력 디렉터리가 이미 존재합니다: {output_path}")
    if output_path.exists() and not output_path.is_dir():
        raise DemValidationError(f"출력 경로는 디렉터리여야 합니다: {output_path}")

    try:
        source = rasterio.open(source_path)
    except (RasterioIOError, OSError) as error:
        raise FileNotFoundError(f"DEM 파일을 열 수 없습니다: {source_path}") from error

    output_path.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{output_path.name}.", dir=output_path.parent))
    try:
        with source:
            validate_dem_dataset(source)
            if source.crs is None:
                raise DemValidationError(
                    "XYZ 타일 생성에는 원본 DEM 좌표계가 필요합니다"
                )
            bounds = transform_bounds(
                source.crs, "EPSG:4326", *source.bounds, densify_pts=21
            )
            geographic_bounds = tuple(float(value) for value in bounds)
            projected_bounds = tuple(
                float(value)
                for value in transform_bounds(
                    source.crs, "EPSG:3857", *source.bounds, densify_pts=21
                )
            )

            indices_by_zoom = {
                zoom: _tile_indices(geographic_bounds, zoom)
                for zoom in range(min_zoom, max_zoom + 1)
            }
            candidate_tile_count = sum(
                (maximum_x - minimum_x + 1) * (maximum_y - minimum_y + 1)
                for minimum_x, maximum_x, minimum_y, maximum_y in indices_by_zoom.values()
            )
            if max_tiles is not None and candidate_tile_count > max_tiles:
                raise DemValidationError(
                    f"예상 타일 수({candidate_tile_count})가 "
                    f"최대 타일 수({max_tiles})를 "
                    "초과합니다"
                )

            tile_count = 0
            for zoom in range(min_zoom, max_zoom + 1):
                vrt, minimum_x, minimum_y = _zoom_vrt(
                    source, zoom, indices_by_zoom[zoom]
                )
                with vrt:
                    current_x: int | None = None
                    tile_directory: Path | None = None
                    for tile in tiles_for_bounds(geographic_bounds, zoom):
                        rgba = _render_tile(
                            vrt,
                            tile,
                            minimum_x,
                            minimum_y,
                            projected_bounds,
                            edge_feather_meters,
                        )
                        if rgba is None:
                            continue
                        if tile.x != current_x:
                            current_x = tile.x
                            tile_directory = (
                                staging / "tiles" / str(tile.zoom) / str(tile.x)
                            )
                            tile_directory.mkdir(parents=True, exist_ok=True)
                        assert tile_directory is not None
                        tile_path = tile_directory / f"{tile.y}.png"
                        Image.fromarray(rgba).save(tile_path, format="PNG")
                        tile_count += 1

        if tile_count == 0:
            raise DemValidationError(
                "DEM에 Terrain-RGB로 변환할 유효한 고도 픽셀이 없습니다"
            )

        tilejson: dict[str, Any] = {
            "tilejson": "3.0.0",
            "name": source_path.stem,
            "scheme": "xyz",
            "tiles": [tiles_url],
            "minzoom": min_zoom,
            "maxzoom": max_zoom,
            "bounds": list(geographic_bounds),
        }
        _write_json(staging / "tilejson.json", tilejson)
        maplibre_source: dict[str, Any] = {
            "type": "raster-dem",
            "tiles": [tiles_url],
            "minzoom": min_zoom,
            "maxzoom": max_zoom,
            "bounds": list(geographic_bounds),
            "tileSize": TILE_SIZE,
            "encoding": "mapbox",
        }
        _write_json(staging / "maplibre-source.json", maplibre_source)
        metadata = {
            **tilejson,
            "encoding": "mapbox",
            "tileSize": TILE_SIZE,
            "edge_feather_meters": edge_feather_meters,
            "source": str(source_path.resolve()),
            "output": str(output_path.resolve()),
            "candidate_tile_count": candidate_tile_count,
            "tile_count": tile_count,
        }
        _write_json(staging / "metadata.json", metadata)
        _publish_directory(staging, output_path, overwrite=overwrite)
        return metadata
    finally:
        shutil.rmtree(staging, ignore_errors=True)
