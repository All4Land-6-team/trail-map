"""DEM 메타데이터 검사와 분석용 GeoTIFF 최적화 기능."""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator, Sequence
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.errors import CRSError
from rasterio.warp import transform_bounds
from rasterio.windows import Window, subdivide


class DemValidationError(ValueError):
    """입력 DEM이 전처리 조건을 만족하지 않을 때 발생한다."""


def _windows(width: int, height: int, chunk_size: int = 1024) -> Iterator[Window]:
    """큰 래스터를 메모리에 모두 올리지 않도록 일정 크기로 나눈다."""

    yield from subdivide(Window(0, 0, width, height), chunk_size, chunk_size)


def paths_alias(first: str | Path, second: str | Path) -> bool:
    """두 경로가 같은 경로이거나 같은 기존 파일을 가리키는지 확인한다."""

    first_path = Path(first)
    second_path = Path(second)
    if first_path.resolve() == second_path.resolve():
        return True
    try:
        return first_path.samefile(second_path)
    except FileNotFoundError:
        return False


def _validate_dataset(dataset: rasterio.io.DatasetReader) -> None:
    if dataset.count != 1:
        raise DemValidationError(f"단일 밴드 DEM만 지원합니다: bands={dataset.count}")
    if not np.issubdtype(np.dtype(dataset.dtypes[0]), np.number):
        raise DemValidationError(f"DEM 밴드는 숫자 형식이어야 합니다: {dataset.dtypes[0]}")


def _matches_expected_crs(crs: CRS | None, expected_crs: str | None) -> bool | None:
    if not expected_crs:
        return None
    if crs is None:
        return False
    return crs == _parse_crs(expected_crs)


def _parse_crs(value: str) -> CRS:
    try:
        return CRS.from_user_input(value)
    except CRSError as error:
        raise DemValidationError(f"올바르지 않은 예상 좌표계입니다: {value}") from error


def _crs_details(crs: CRS | None, expected_crs: str | None) -> dict[str, Any]:
    if crs is None:
        return {
            "wkt": None,
            "authority": None,
            "expected": expected_crs,
            "matches_expected": False if expected_crs else None,
        }

    authority = crs.to_authority()
    return {
        "wkt": crs.to_wkt(),
        "authority": ":".join(authority) if authority else None,
        "expected": expected_crs,
        "matches_expected": _matches_expected_crs(crs, expected_crs),
    }


def inspect_dem(path: str | Path, *, expected_crs: str | None = None) -> dict[str, Any]:
    """DEM 구조와 유효 고도 범위를 검사해 JSON 직렬화 가능한 값으로 반환한다."""

    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(f"DEM 파일을 찾을 수 없습니다: {source}")

    with rasterio.open(source) as dataset:
        _validate_dataset(dataset)

        valid_pixel_count = 0
        minimum: float | None = None
        maximum: float | None = None

        for window in _windows(dataset.width, dataset.height):
            values = dataset.read(1, window=window, masked=True).compressed()
            if values.size == 0:
                continue
            finite_values = values[np.isfinite(values)]
            if finite_values.size == 0:
                continue

            valid_pixel_count += int(finite_values.size)
            window_minimum = float(finite_values.min())
            window_maximum = float(finite_values.max())
            minimum = window_minimum if minimum is None else min(minimum, window_minimum)
            maximum = window_maximum if maximum is None else max(maximum, window_maximum)

        bounds = dataset.bounds
        geographic_bounds: dict[str, float] | None = None
        if dataset.crs:
            try:
                west, south, east, north = transform_bounds(
                    dataset.crs, "EPSG:4326", *bounds, densify_pts=21
                )
                geographic_bounds = {
                    "west": west,
                    "south": south,
                    "east": east,
                    "north": north,
                }
            except (CRSError, ValueError):
                geographic_bounds = None

        return {
            "path": str(source.resolve()),
            "driver": dataset.driver,
            "width": dataset.width,
            "height": dataset.height,
            "band_count": dataset.count,
            "dtype": dataset.dtypes[0],
            "nodata": dataset.nodata,
            "resolution": {"x": float(dataset.res[0]), "y": float(dataset.res[1])},
            "bounds": {
                "left": float(bounds[0]),
                "bottom": float(bounds[1]),
                "right": float(bounds[2]),
                "top": float(bounds[3]),
            },
            "geographic_bounds": geographic_bounds,
            "crs": _crs_details(dataset.crs, expected_crs),
            "elevation": {
                "minimum": minimum,
                "maximum": maximum,
                "valid_pixel_count": valid_pixel_count,
                "total_pixel_count": dataset.width * dataset.height,
            },
            "storage": {
                "compression": dataset.compression.value if dataset.compression else None,
                "is_tiled": bool(dataset.profile.get("tiled", False)),
                "block_shapes": [list(shape) for shape in dataset.block_shapes],
                "overview_levels": dataset.overviews(1),
            },
        }


def _normalized_block_size(requested: int) -> int:
    if requested < 16 or requested % 16 != 0:
        raise DemValidationError("GeoTIFF 블록 크기는 16 이상의 16 배수여야 합니다")
    return requested


def optimize_dem(
    source_path: str | Path,
    output_path: str | Path,
    *,
    expected_crs: str | None = None,
    require_crs_match: bool = False,
    block_size: int = 512,
    overview_levels: Sequence[int] = (2, 4, 8, 16),
    overwrite: bool = False,
) -> dict[str, Any]:
    """원본 공간정보와 고도값을 유지한 채 분석용 GeoTIFF로 최적화한다.

    좌표계는 원본 값을 그대로 보존한다. ``expected_crs``는 검증에만 사용하며,
    출처 근거 없이 CRS를 새로 지정하지 않는다.
    """

    source = Path(source_path)
    output = Path(output_path)
    if paths_alias(source, output):
        raise DemValidationError("원본 DEM과 출력 GeoTIFF 경로는 달라야 합니다")
    if require_crs_match and not expected_crs:
        raise DemValidationError("엄격한 좌표계 검사에는 expected_crs가 필요합니다")
    if expected_crs:
        _parse_crs(expected_crs)
    if output.exists() and not overwrite:
        raise FileExistsError(f"출력 파일이 이미 존재합니다: {output}")

    block_size = _normalized_block_size(block_size)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f".{output.stem}.", dir=output.parent) as directory:
        temporary_output = Path(directory) / output.name

        with rasterio.open(source) as src:
            _validate_dataset(src)
            if require_crs_match and not _matches_expected_crs(src.crs, expected_crs):
                raise DemValidationError(
                    f"원본 좌표계가 예상 좌표계({expected_crs})와 일치하지 않습니다"
                )

            profile = src.profile.copy()
            profile.update(
                driver="GTiff",
                tiled=True,
                blockxsize=block_size,
                blockysize=block_size,
                compress="deflate",
                predictor=3 if np.issubdtype(np.dtype(src.dtypes[0]), np.floating) else 2,
                bigtiff="IF_SAFER",
            )

            with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True):
                with rasterio.open(temporary_output, "w", **profile) as dst:
                    for window in _windows(src.width, src.height, block_size):
                        dst.write(src.read(1, window=window), 1, window=window)
                        dst.write_mask(src.dataset_mask(window=window), window=window)

                    dst.update_tags(**src.tags())
                    dst.update_tags(
                        TRAIL_MAP_SOURCE=source.name,
                        TRAIL_MAP_PROCESSING="lossless-deflate-tiled",
                    )
                    dst.update_tags(1, **src.tags(1))
                    if src.descriptions[0]:
                        dst.set_band_description(1, src.descriptions[0])
                    if src.units[0]:
                        dst.set_band_unit(1, src.units[0])

                    valid_overviews = [
                        level
                        for level in overview_levels
                        if level > 1 and min(src.width, src.height) // level >= 1
                    ]
                    if valid_overviews:
                        dst.build_overviews(valid_overviews, Resampling.average)
                        dst.update_tags(ns="rio_overview", resampling="average")

        metadata = inspect_dem(temporary_output, expected_crs=expected_crs)
        source_mode = source.stat().st_mode & 0o666
        os.chmod(temporary_output, source_mode or 0o600)

        if overwrite:
            os.replace(temporary_output, output)
        else:
            try:
                os.link(temporary_output, output)
            except FileExistsError as error:
                raise FileExistsError(f"출력 파일이 이미 존재합니다: {output}") from error

    metadata["path"] = str(output.resolve())
    return metadata

