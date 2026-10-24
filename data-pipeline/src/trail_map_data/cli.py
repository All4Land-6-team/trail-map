"""데이터 전처리 명령행 진입점."""

from __future__ import annotations

import argparse
import json
import math
import os
import tempfile
from pathlib import Path
from typing import Any, Sequence

from trail_map_data.dem import DemValidationError, inspect_dem, optimize_dem, paths_alias
from trail_map_data.terrain import DEFAULT_EDGE_FEATHER_METERS, generate_terrain_tiles


def _json_safe(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _write_metadata(metadata: dict[str, Any], output: Path | None) -> None:
    content = json.dumps(_json_safe(metadata), ensure_ascii=False, indent=2, allow_nan=False)
    if output is None:
        print(content)
        return

    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{output.name}.", suffix=".tmp", dir=output.parent
    )
    temporary_output = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(f"{content}\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary_output, 0o644)
        os.replace(temporary_output, output)
    finally:
        temporary_output.unlink(missing_ok=True)
    print(f"메타데이터 저장: {output}")


def _reject_metadata_collision(
    metadata_output: Path | None, protected_paths: Sequence[Path]
) -> None:
    if metadata_output is None:
        return

    resolved_output = metadata_output.resolve()
    for protected_path in protected_paths:
        if resolved_output == protected_path.resolve() or paths_alias(
            metadata_output, protected_path
        ):
            raise DemValidationError(
                f"메타데이터 경로는 DEM 경로와 달라야 합니다: {metadata_output}"
            )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="산길지도 공간데이터 전처리 도구")
    commands = parser.add_subparsers(required=True)
    dem_parser = commands.add_parser("dem", help="DEM 전처리")
    dem_commands = dem_parser.add_subparsers(dest="command", required=True)

    inspect_parser = dem_commands.add_parser("inspect", help="DEM 메타데이터 검사")
    inspect_parser.add_argument("input", type=Path, help="검사할 DEM 경로")
    inspect_parser.add_argument("--expected-crs", help="비교할 예상 좌표계")
    inspect_parser.add_argument("--output", type=Path, help="검사 결과 JSON 경로")

    optimize_parser = dem_commands.add_parser(
        "optimize", help="분석용 GeoTIFF 최적화"
    )
    optimize_parser.add_argument("input", type=Path, help="원본 DEM 경로")
    optimize_parser.add_argument("output", type=Path, help="출력 GeoTIFF 경로")
    optimize_parser.add_argument("--expected-crs", help="비교할 예상 좌표계")
    optimize_parser.add_argument(
        "--require-crs-match",
        action="store_true",
        help="원본 좌표계가 예상 좌표계와 다르면 중단",
    )
    optimize_parser.add_argument("--block-size", type=int, default=512)
    optimize_parser.add_argument("--metadata-output", type=Path)
    optimize_parser.add_argument("--overwrite", action="store_true")

    terrain_parser = dem_commands.add_parser(
        "terrain-tiles", help="MapLibre용 Terrain-RGB XYZ 타일 생성"
    )
    terrain_parser.add_argument("input", type=Path, help="분석용 GeoTIFF 경로")
    terrain_parser.add_argument("output", type=Path, help="타일 출력 디렉터리")
    terrain_parser.add_argument("--min-zoom", type=int, required=True)
    terrain_parser.add_argument("--max-zoom", type=int, required=True)
    terrain_parser.add_argument(
        "--max-tiles",
        type=int,
        required=True,
        help="생성 전에 허용할 최대 XYZ 타일 수",
    )
    terrain_parser.add_argument(
        "--tiles-url",
        default="./tiles/{z}/{x}/{y}.png",
        help="TileJSON에 기록할 XYZ URL 템플릿",
    )
    terrain_parser.add_argument(
        "--edge-feather-meters",
        type=float,
        default=DEFAULT_EDGE_FEATHER_METERS,
        help=(
            "DEM 외곽 고도를 0m로 완만하게 낮출 거리"
            f"(기본 {DEFAULT_EDGE_FEATHER_METERS:g}m)"
        ),
    )
    terrain_parser.add_argument("--overwrite", action="store_true")

    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = _build_parser().parse_args(argv)

    if args.command == "inspect":
        _reject_metadata_collision(args.output, [args.input])
        metadata = inspect_dem(args.input, expected_crs=args.expected_crs)
        _write_metadata(metadata, args.output)
        return

    if args.command == "terrain-tiles":
        metadata = generate_terrain_tiles(
            args.input,
            args.output,
            min_zoom=args.min_zoom,
            max_zoom=args.max_zoom,
            tiles_url=args.tiles_url,
            max_tiles=args.max_tiles,
            edge_feather_meters=args.edge_feather_meters,
            overwrite=args.overwrite,
        )
        print(
            f"Terrain-RGB 타일 생성: {metadata['tile_count']}개 "
            f"({metadata['minzoom']}~{metadata['maxzoom']} 줌)"
        )
        return

    _reject_metadata_collision(args.metadata_output, [args.input, args.output])
    metadata = optimize_dem(
        args.input,
        args.output,
        expected_crs=args.expected_crs,
        require_crs_match=args.require_crs_match,
        block_size=args.block_size,
        overwrite=args.overwrite,
    )
    _write_metadata(metadata, args.metadata_output)


if __name__ == "__main__":
    main()

