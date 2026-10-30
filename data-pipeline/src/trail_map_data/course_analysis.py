"""DEM과 코스 GeoJSON으로 고도·경사 프로필을 생성한다.

거리는 DEM의 투영 좌표계에서 측정한 수평 거리다. 결측 샘플을 건너뛰어
상승량을 합산하지 않으며, 확인되지 않은 고도 단위를 m로 간주하지 않는다.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import tempfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.warp import transform
from rasterio.windows import Window

from trail_map_data.dem import paths_alias, validate_dem_dataset

ALGORITHM_VERSION = "course-dem-v1"
SCHEMA_VERSION = 1
_DISTANCE_EPSILON = 1e-6
_UNIT_FACTORS = {"m": 1.0, "ft": 0.3048}
_UNIT_NAMES = {
    "m": "m", "meter": "m", "metre": "m", "meters": "m", "metres": "m",
    "ft": "ft", "foot": "ft", "feet": "ft", "international foot": "ft",
}


def _finite_number(value: Any) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


class CourseAnalysisError(ValueError):
    """입력 경로나 분석 설정을 사용할 수 없을 때 발생한다."""


@dataclass(frozen=True)
class AnalysisConfig:
    """샘플 간격은 운영 정책으로 가정하지 않고 호출자가 명시한다."""

    sample_interval_meters: float
    sampling_method: str = "bilinear"
    elevation_unit: str = "auto"
    vertical_reference: str | None = None
    max_samples: int = 100_000

    def __post_init__(self) -> None:
        if (not _finite_number(self.sample_interval_meters)
                or self.sample_interval_meters <= 0):
            raise CourseAnalysisError("샘플 간격은 유한한 양수여야 합니다")
        if not isinstance(self.sampling_method, str) or self.sampling_method not in {"nearest", "bilinear"}:
            raise CourseAnalysisError("샘플링 방식은 nearest 또는 bilinear여야 합니다")
        if not isinstance(self.elevation_unit, str) or self.elevation_unit not in {"auto", "m", "ft", "unknown"}:
            raise CourseAnalysisError("고도 단위는 auto, m, ft, unknown 중 하나여야 합니다")
        if (isinstance(self.max_samples, bool) or not isinstance(self.max_samples, int)
                or self.max_samples < 2):
            raise CourseAnalysisError("최대 샘플 수는 2 이상의 정수여야 합니다")
        if self.vertical_reference is not None and (
            not isinstance(self.vertical_reference, str) or not self.vertical_reference.strip()
        ):
            raise CourseAnalysisError("수직 기준은 비어 있지 않은 문자열이어야 합니다")
        if isinstance(self.vertical_reference, str):
            reference = self.vertical_reference.strip()
            object.__setattr__(self, "vertical_reference",
                               None if reference.lower() in {"unknown", "unverified"} else reference)


def _positive_id(properties: dict[str, Any], key: str) -> int:
    value = properties.get(key)
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise CourseAnalysisError(f"GeoJSON properties.{key}는 양의 정수여야 합니다")
    return value


def _load_course(path: Path, max_vertices: int) -> tuple[dict[str, Any], np.ndarray]:
    try:
        feature = json.loads(path.read_text(encoding="utf-8-sig"))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise CourseAnalysisError("코스 파일은 UTF-8 GeoJSON이어야 합니다") from error
    if not isinstance(feature, dict) or feature.get("type") != "Feature":
        raise CourseAnalysisError("코스 하나를 담은 GeoJSON Feature를 입력하세요")
    geometry = feature.get("geometry")
    properties = feature.get("properties")
    if not isinstance(properties, dict):
        raise CourseAnalysisError("코스 식별 정보를 담은 properties가 필요합니다")
    if not isinstance(geometry, dict) or geometry.get("type") != "LineString":
        raise CourseAnalysisError("코스 geometry는 LineString이어야 합니다")
    if "crs" in feature or "crs" in geometry:
        raise CourseAnalysisError("crs 확장 없이 EPSG:4326 [경도, 위도] GeoJSON을 입력하세요")
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        raise CourseAnalysisError("코스에는 좌표가 2개 이상 필요합니다")
    if len(coordinates) > max_vertices:
        raise CourseAnalysisError("입력 좌표 수가 최대 샘플 수를 초과합니다")
    points = []
    for coordinate in coordinates:
        if (not isinstance(coordinate, list) or len(coordinate) not in {2, 3}
                or any(not _finite_number(v) for v in coordinate)):
            raise CourseAnalysisError("각 좌표는 유한한 숫자의 [경도, 위도]여야 합니다")
        lon, lat = coordinate[:2]
        if not -180 <= lon <= 180 or not -90 <= lat <= 90:
            raise CourseAnalysisError("경도·위도 범위를 벗어난 좌표입니다")
        points.append([float(lon), float(lat)])
    source_kind = properties.get("source_kind", "unknown")
    if not isinstance(source_kind, str) or source_kind not in {"development", "official", "user", "unknown"}:
        raise CourseAnalysisError("source_kind는 development, official, user, unknown 중 하나입니다")
    name = properties.get("course_name")
    if name is not None and not isinstance(name, str):
        raise CourseAnalysisError("course_name은 문자열이어야 합니다")
    info = {key: _positive_id(properties, key)
            for key in ("course_id", "mountain_id", "course_version")}
    if properties.get("source_id") is not None:
        info["source_id"] = _positive_id(properties, "source_id")
    info.update(course_name=name, source_kind=source_kind,
                geometry={"type": "LineString", "coordinates": points})
    return info, np.asarray(points, dtype=np.float64)


def _resample(points: np.ndarray, factor: float, config: AnalysisConfig):
    differences = np.hypot(*np.diff(points, axis=0).T) * factor
    keep = np.r_[True, differences > _DISTANCE_EPSILON]
    points = points[keep]
    if len(points) < 2:
        raise CourseAnalysisError("중복 좌표를 제외한 코스 길이가 0입니다")
    lengths = np.hypot(*np.diff(points, axis=0).T) * factor
    vertices = np.r_[0.0, np.cumsum(lengths)]
    total = float(vertices[-1])
    if not math.isfinite(total) or total <= _DISTANCE_EPSILON:
        raise CourseAnalysisError("코스 길이를 계산할 수 없습니다")
    ratio = total / config.sample_interval_meters
    if not math.isfinite(ratio) or ratio >= config.max_samples:
        raise CourseAnalysisError("최대 샘플 수를 초과합니다. 샘플 간격을 늘리세요")
    regular = np.arange(math.floor(ratio) + 1) * config.sample_interval_meters
    # 굴곡점을 보존해 모서리를 지름길로 연결하지 않는다.
    distances = np.sort(np.r_[regular, vertices])
    distances = distances[np.r_[True, np.diff(distances) > _DISTANCE_EPSILON]]
    distances[-1] = total
    if len(distances) > config.max_samples:
        raise CourseAnalysisError("굴곡점을 포함한 샘플 수가 최대 샘플 수를 초과합니다")
    xy = np.column_stack([np.interp(distances, vertices, points[:, axis])
                          for axis in (0, 1)])
    return distances, xy, int((~keep).sum())


def _snap(value: float) -> float:
    integer = round(value)
    return float(integer) if abs(value - integer) < 1e-7 else value


def _sample(dataset, x: float, y: float, method: str) -> tuple[float | None, str]:
    inverse = ~dataset.transform
    col = inverse.a * x + inverse.b * y + inverse.c
    row = inverse.d * x + inverse.e * y + inverse.f
    col, row = _snap(col), _snap(row)
    if not (0 <= col < dataset.width and 0 <= row < dataset.height):
        return None, "OUTSIDE_DEM"
    if method == "nearest":
        cells = [(math.floor(row), math.floor(col), 1.0)]
    else:
        col, row = _snap(col - 0.5), _snap(row - 0.5)
        c0, r0 = math.floor(col), math.floor(row)
        dx, dy = col - c0, row - r0
        cells = [(r0, c0, (1 - dx) * (1 - dy)), (r0, c0 + 1, dx * (1 - dy)),
                 (r0 + 1, c0, (1 - dx) * dy), (r0 + 1, c0 + 1, dx * dy)]
        cells = [(r, c, w) for r, c, w in cells if w > 0]
        if any(not (0 <= c < dataset.width and 0 <= r < dataset.height)
               for r, c, _ in cells):
            return None, "INSUFFICIENT_NEIGHBORS"
    r0, c0 = min(r for r, _, _ in cells), min(c for _, c, _ in cells)
    r1, c1 = max(r for r, _, _ in cells), max(c for _, c, _ in cells)
    values = dataset.read(1, window=Window(c0, r0, c1 - c0 + 1, r1 - r0 + 1), masked=True)
    result = 0.0
    for r, c, weight in cells:
        value = values[r - r0, c - c0]
        if np.ma.is_masked(value):
            return None, "NODATA"
        if not math.isfinite(float(value)):
            return None, "NON_FINITE"
        result += float(value) * weight
    result = result * dataset.scales[0] + dataset.offsets[0]
    return (result, "VALID") if math.isfinite(result) else (None, "NON_FINITE")


def _elevation_unit(dataset, requested: str) -> tuple[str, str]:
    label = dataset.units[0]
    declared = _UNIT_NAMES.get(label.strip().lower()) if label else None
    if requested == "unknown":
        return "unknown", "unverified"
    if requested == "auto":
        return (declared, "raster_metadata") if declared else ("unknown", "unverified")
    if label and (declared is None or declared != requested):
        raise CourseAnalysisError("지정한 고도 단위와 DEM 밴드의 단위가 다릅니다")
    return requested, "caller_declaration"


def _sha256(path: Path, original: os.stat_result) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    current = path.stat()
    if (original.st_size, original.st_mtime_ns) != (current.st_size, current.st_mtime_ns):
        raise CourseAnalysisError(f"분석 도중 입력 파일이 변경됐습니다: {path.name}")
    return digest.hexdigest()


def analyze_course(
    dem_path: str | Path, course_path: str | Path, *, config: AnalysisConfig,
) -> dict[str, Any]:
    """GeoJSON Feature 하나를 분석한다. 원본 파일을 수정하지 않는다."""

    dem_path, course_path = Path(dem_path), Path(course_path)
    dem_stat, course_stat = dem_path.stat(), course_path.stat()
    course, coordinates = _load_course(course_path, config.max_samples)
    with rasterio.open(dem_path) as dataset:
        auxiliary_files = [(Path(name), Path(name).stat()) for name in dataset.files
                           if Path(name).resolve() != dem_path.resolve()]
        validate_dem_dataset(dataset)
        if np.issubdtype(np.dtype(dataset.dtypes[0]), np.complexfloating):
            raise CourseAnalysisError("DEM 고도는 복소수가 아닌 실수여야 합니다")
        affine = dataset.transform
        determinant = affine.a * affine.e - affine.b * affine.d
        if not all(math.isfinite(v) for v in affine) or not math.isfinite(determinant) or determinant == 0:
            raise CourseAnalysisError("DEM의 픽셀 좌표 변환을 역산할 수 없습니다")
        if dataset.crs is None or not dataset.crs.is_projected:
            raise CourseAnalysisError("DEM에는 길이 단위가 있는 투영 좌표계가 필요합니다")
        linear_unit, factor = dataset.crs.linear_units_factor
        if not math.isfinite(factor) or factor <= 0:
            raise CourseAnalysisError("DEM 좌표계의 미터 환산 계수가 올바르지 않습니다")
        if not all(math.isfinite(v) for v in (*dataset.scales, *dataset.offsets)):
            raise CourseAnalysisError("DEM의 scale 또는 offset이 유한하지 않습니다")
        xs, ys = transform("EPSG:4326", dataset.crs, coordinates[:, 0], coordinates[:, 1])
        projected = np.column_stack([xs, ys])
        if not np.isfinite(projected).all():
            raise CourseAnalysisError("DEM 좌표계로 변환할 수 없는 코스 좌표입니다")
        distances, xy, duplicates = _resample(projected, factor, config)
        lons, lats = transform(dataset.crs, "EPSG:4326", xy[:, 0], xy[:, 1])
        if not np.isfinite(np.column_stack([lons, lats])).all():
            raise CourseAnalysisError("샘플 좌표를 경도·위도로 변환할 수 없습니다")
        unit, unit_source = _elevation_unit(dataset, config.elevation_unit)
        height_factor = _UNIT_FACTORS.get(unit)
        samples = []
        for index, (distance, (x, y), lon, lat) in enumerate(zip(distances, xy, lons, lats)):
            value, status = _sample(dataset, x, y, config.sampling_method)
            samples.append({
                "sample_index": index, "distance_meters": float(distance),
                "longitude": float(lon), "latitude": float(lat),
                "elevation_source_value": value,
                "elevation_meters": value * height_factor
                if value is not None and height_factor is not None else None,
                "slope_percent": None, "sample_status": status,
            })
        dem_metadata = {
            "crs_wkt": dataset.crs.to_wkt(), "crs_authority": dataset.crs.to_authority(),
            "linear_unit": linear_unit, "linear_unit_to_meters": factor,
            "band_unit": dataset.units[0], "band_scale": dataset.scales[0],
            "band_offset": dataset.offsets[0],
        }
    summary, status, reasons = _summarize(samples, unit, config.vertical_reference)
    return {
        "schema_version": SCHEMA_VERSION, "algorithm_version": ALGORITHM_VERSION,
        "source_type": "SERVICE_CALCULATED",
        "calculated_at": datetime.now(timezone.utc).isoformat(),
        "quality_status": status, "quality_reasons": reasons,
        "course": course,
        "inputs": {
            "course": {"path": str(course_path.resolve()), "sha256": _sha256(course_path, course_stat)},
            "dem": {"path": str(dem_path.resolve()), "sha256": _sha256(dem_path, dem_stat),
                    **dem_metadata,
                    "auxiliary_files": [{"path": str(p.resolve()), "sha256": _sha256(p, st)}
                                        for p, st in auxiliary_files]},
        },
        "settings": {
            "sample_interval_meters": config.sample_interval_meters,
            "sampling_method": config.sampling_method,
            "resampling_method": "horizontal_chainage_preserve_vertices",
            "distance_method": "projected_2d_dem_crs",
            "elevation_unit": unit, "elevation_unit_source": unit_source,
            "vertical_reference": config.vertical_reference,
            "elevation_processing": "unsmoothed",
            "slope_convention": "signed_percent_from_previous_sample",
            "max_samples": config.max_samples,
        },
        "diagnostics": {"removed_consecutive_duplicate_count": duplicates,
                        "sample_status_counts": dict(Counter(p["sample_status"] for p in samples))},
        "summary": summary, "profile": samples,
    }


def _summarize(samples, unit, vertical_reference):
    heights = [p["elevation_meters"] for p in samples if p["elevation_meters"] is not None]
    raw_valid = sum(p["sample_status"] == "VALID" for p in samples)
    covered = 0.0
    gain = loss = 0.0
    analyzed_segments = 0
    for before, after in zip(samples, samples[1:]):
        distance = after["distance_meters"] - before["distance_meters"]
        if before["sample_status"] == after["sample_status"] == "VALID":
            covered += distance
        if before["elevation_meters"] is None or after["elevation_meters"] is None:
            continue
        difference = after["elevation_meters"] - before["elevation_meters"]
        after["slope_percent"] = 100.0 * difference / distance
        if not math.isfinite(after["slope_percent"]):
            raise CourseAnalysisError("계산된 경사가 유한하지 않습니다. 입력 고도·단위를 확인하세요")
        gain += max(difference, 0)
        loss += max(-difference, 0)
        analyzed_segments += 1
    if not math.isfinite(gain) or not math.isfinite(loss):
        raise CourseAnalysisError("누적 고도 변화량이 유한하지 않습니다")
    reasons = []
    if raw_valid < len(samples):
        reasons.append("MISSING_DEM_SAMPLES")
    if unit == "unknown":
        reasons.append("UNVERIFIED_ELEVATION_UNIT")
    if vertical_reference is None:
        reasons.append("UNVERIFIED_VERTICAL_REFERENCE")
    if analyzed_segments == 0:
        reasons.append("NO_CONTIGUOUS_METRIC_HEIGHT_SEGMENTS")
    status = "NO_DATA" if raw_valid == 0 else ("PARTIAL" if reasons else "AVAILABLE")
    total = samples[-1]["distance_meters"]
    return {
        "distance_meters": total, "sample_count": len(samples),
        "valid_dem_sample_count": raw_valid,
        "valid_elevation_meters_sample_count": len(heights),
        "sample_coverage_percent": 100.0 * raw_valid / len(samples),
        "covered_distance_meters": covered,
        "distance_coverage_percent": 100.0 * covered / total,
        "min_elevation_meters": min(heights) if heights else None,
        "max_elevation_meters": max(heights) if heights else None,
        "elevation_gain_meters": gain if analyzed_segments else None,
        "elevation_loss_meters": loss if analyzed_segments else None,
        "analyzed_segment_count": analyzed_segments,
    }, status, reasons


def analyze_course_to_file(
    dem_path: str | Path, course_path: str | Path, output_path: str | Path, *,
    config: AnalysisConfig, overwrite: bool = False,
) -> dict[str, Any]:
    """입력을 보호하고 검사가 끝난 JSON만 원자적으로 저장한다."""

    dem, course, output = Path(dem_path), Path(course_path), Path(output_path)
    protected = [dem, course, *(Path(str(dem) + suffix) for suffix in (".aux.xml", ".msk", ".ovr")),
                 dem.with_suffix(".tfw")]
    if any(paths_alias(output, source) for source in protected):
        raise CourseAnalysisError("분석 결과 경로는 입력 파일 및 DEM 보조 파일과 달라야 합니다")
    if output.exists() and not overwrite:
        raise FileExistsError(f"분석 결과가 이미 존재합니다: {output}")
    result = analyze_course(dem, course, config=config)
    content = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{output.name}.", suffix=".tmp", dir=output.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(content + "\n")
            stream.flush()
            os.fsync(stream.fileno())
        if overwrite:
            os.replace(temporary, output)
        else:
            os.link(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)
    return result
