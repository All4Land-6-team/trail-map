"""현재 공용 분석과 같은 입력으로 급경사 비율을 추가한다. DB에는 쓰지 않는다."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write("\n")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def same_value(before, after, label):
    if isinstance(before, bool) or isinstance(after, bool):
        equal = type(before) is type(after) and before == after
    elif isinstance(before, (int, float)) and isinstance(after, (int, float)):
        equal = math.isfinite(before) and math.isfinite(after) and math.isclose(
            before, after, rel_tol=1e-12, abs_tol=1e-6)
    else:
        equal = before == after
    require(equal, f"계산값 또는 식별 정보가 달라요: {label}")


SUMMARY_FIELDS = {
    "distance_meters": "distanceMeters", "min_elevation_meters": "minElevationMeters",
    "max_elevation_meters": "maxElevationMeters", "elevation_gain_meters": "elevationGainMeters",
    "elevation_loss_meters": "elevationLossMeters",
}
COVERAGE_FIELDS = {
    "sample_count": "sampleCount", "valid_dem_sample_count": "validDemSampleCount",
    "valid_elevation_meters_sample_count": "validElevationMetersSampleCount",
    "sample_coverage_percent": "sampleCoveragePercent", "covered_distance_meters": "coveredDistanceMeters",
    "distance_coverage_percent": "distanceCoveragePercent", "analyzed_segment_count": "analyzedSegmentCount",
}
SETTINGS_FIELDS = {
    "sample_interval_meters": "sampleIntervalMeters", "sampling_method": "samplingMethod",
    "resampling_method": "resamplingMethod", "distance_method": "distanceMethod",
    "elevation_unit": "elevationUnit", "elevation_unit_source": "elevationUnitSource",
    "vertical_reference": "verticalReference", "elevation_processing": "elevationProcessing",
    "slope_convention": "slopeConvention",
}
SAMPLE_FIELDS = {
    "sample_index": "sampleIndex", "distance_meters": "distanceMeters",
    "elevation_meters": "elevationMeters", "slope_percent": "slopePercent", "sample_status": "sampleStatus",
}


def matches_api(document, analysis, profile):
    course = document["course"]
    for local, remote in {"course_id": "courseId", "mountain_id": "mountainId",
                          "course_version": "analyzedCourseVersion", "source_kind": "sourceKind"}.items():
        require(course.get(local) == analysis[remote], f"기존 문서의 {local} 불일치")
    for local, remote in {"algorithm_version": "algorithmVersion", "source_type": "sourceType",
                          "quality_status": "qualityStatus"}.items():
        require(document[local] == analysis[remote], f"기존 문서의 {local} 불일치")
    require(datetime.fromisoformat(document["calculated_at"].replace("Z", "+00:00")) ==
            datetime.fromisoformat(analysis["calculatedAt"].replace("Z", "+00:00")), "분석 시각 불일치")
    require(set(document["quality_reasons"]) == set(analysis["qualityReasons"]), "품질 사유 불일치")
    for local, remote in SETTINGS_FIELDS.items():
        same_value(document["settings"][local], analysis["settings"][remote], local)
    if document["schema_version"] == 2:
        same_value(document["settings"]["steep_slope_threshold_percent"],
                   analysis["settings"]["steepSlopeThresholdPercent"], "급경사 임계값")
        require(document["settings"]["steep_slope_method"] == analysis["settings"]["steepSlopeMethod"], "급경사 방식 불일치")
        same_value(document["summary"]["steep_section_ratio_percent"],
                   analysis["metrics"]["steepSectionRatioPercent"], "기존 급경사 비율")
    for fields, remote_values in ((SUMMARY_FIELDS, analysis["metrics"]), (COVERAGE_FIELDS, analysis["coverage"])):
        for local, remote in fields.items():
            same_value(document["summary"][local], remote_values[remote], local)
    samples = profile["samples"]
    require(len(document["profile"]) == len(samples), "샘플 개수 불일치")
    for index, (before, after) in enumerate(zip(document["profile"], samples)):
        for local, remote in SAMPLE_FIELDS.items():
            same_value(before[local], after[remote], f"sample {index} {local}")
        for axis, local in enumerate(("longitude", "latitude")):
            require(math.isclose(before[local], after["coordinate"][axis], rel_tol=0, abs_tol=1e-9),
                    f"sample {index} 좌표 불일치")


def verify_new(before, after, threshold):
    for key in ("source_type", "course", "diagnostics"):
        require(before[key] == after[key], f"급경사 지표 외 변경: {key}")
    require(after["schema_version"] == 2 and
            after["algorithm_version"] == f"course-dem-v2-steep-{float(threshold)}", "급경사 계산 버전 불일치")
    expected_settings = dict(before["settings"], steep_slope_threshold_percent=float(threshold),
                             steep_slope_method="absolute_slope_gte_distance_weighted")
    require(after["settings"] == expected_settings, "급경사 정책 외 분석 설정이 달라요")
    require(after["settings"]["elevation_unit"] == "m", "기존 m 단위 불일치")
    require(set(after["quality_reasons"]) == set(before["quality_reasons"]),
            "기존 품질 사유가 달라요")
    expected_quality = "NO_DATA" if after["summary"]["valid_dem_sample_count"] == 0 else (
        "PARTIAL" if after["quality_reasons"] else "AVAILABLE")
    require(after["quality_status"] == expected_quality, "분석 품질 상태 불일치")
    old_dem = json.loads(json.dumps(before["inputs"]["dem"]))
    new_dem = json.loads(json.dumps(after["inputs"]["dem"]))
    for value in (old_dem, new_dem):
        value.pop("path", None)
        for auxiliary in value.get("auxiliary_files", []):
            auxiliary.pop("path", None)
    require(old_dem == new_dem, "DEM 지문 또는 메타데이터가 달라요")
    new_metrics = {"slope_analyzed_distance_meters", "steep_distance_meters", "steep_section_ratio_percent"}
    require(set(before["summary"]) - new_metrics == set(after["summary"]) - new_metrics, "요약 필드 불일치")
    for key, value in before["summary"].items():
        if key not in new_metrics:
            same_value(value, after["summary"][key], key)
    require(len(before["profile"]) == len(after["profile"]), "새 샘플 개수 불일치")
    for index, (old, new) in enumerate(zip(before["profile"], after["profile"])):
        require(old.keys() == new.keys(), "프로필 필드 불일치")
        for key, value in old.items():
            same_value(value, new[key], f"sample {index} {key}")


def prepare(repo, output, api, threshold=20.0):
    from trail_map_data.course_analysis import AnalysisConfig, analyze_course_to_file
    AnalysisConfig(sample_interval_meters=10, elevation_unit="m", steep_slope_threshold_percent=threshold)

    dem = repo / "data/processed/dem/bukhansan/analysis/bukhansan_dem.tif"
    analysis_root = repo / "data/processed/course-analysis"
    require(dem.is_file(), f"분석용 DEM이 없어요: {dem}")
    require(output.is_relative_to(analysis_root.resolve()) and output != analysis_root.resolve(),
            "출력은 data/processed/course-analysis 아래 새 폴더로 지정해 주세요")
    require(not output.exists(), f"출력 폴더가 이미 있어요: {output}")

    def get(endpoint):
        with urlopen(api.rstrip("/") + endpoint, timeout=60) as response:
            return json.load(response)["data"]

    baseline = {}
    for course_id in range(1, 14):
        analysis = get(f"/api/v1/courses/{course_id}/analysis")
        require(analysis["courseId"] == course_id and analysis["qualityStatus"] in {"PARTIAL", "AVAILABLE", "NO_DATA"},
                f"코스 {course_id}: 현재 버전의 기존 분석이 필요해요")
        require(analysis["settings"]["elevationUnit"] == "m" and
                analysis["settings"]["elevationUnitSource"] == "caller_declaration", f"코스 {course_id}: 확인된 m 단위 기록이 아니에요")
        require(analysis["currentCourseVersion"] == analysis["analyzedCourseVersion"], f"코스 {course_id}: 버전 변경")
        require(analysis["metrics"].get("estimatedDurationSeconds") is None,
                f"코스 {course_id}: 별도 예상 시간 지표가 있어 이전 정책을 먼저 확인해야 해요")
        require(analysis["metrics"].get("steepSectionRatioPercent") is None
                or analysis["settings"].get("steepSlopeThresholdPercent") is not None,
                f"코스 {course_id}: 계산 정책이 없는 별도 급경사 지표가 있어요")
        expected_profile = f"/api/v1/course-analyses/{analysis['analysisId']}/profile"
        require(analysis["profileUrl"] == expected_profile, "프로필 주소 불일치")
        profile = get(expected_profile)
        require(profile["analysis"] == analysis, f"코스 {course_id}: 요약과 프로필 메타데이터 불일치")
        route = get(f"/api/v1/courses/{course_id}/route")
        require(route["courseId"] == course_id and route["courseVersion"] == analysis["currentCourseVersion"] and
                route["mountainId"] == analysis["mountainId"], f"코스 {course_id}: 경로 식별 정보 불일치")
        baseline[course_id] = {"analysis": analysis, "profile": profile, "route": route}
    print("기존 API 13개 코스 조회 완료", flush=True)

    dem_hash = sha256(dem)
    sources = {}
    for path in sorted(analysis_root.rglob("*.json")):
        try:
            document = read_json(path)
            course_id = document["course"]["course_id"]
            if course_id not in baseline or course_id in sources:
                continue
            if document["settings"].get("elevation_unit_source") != "caller_declaration":
                continue
            if document["inputs"]["dem"]["sha256"] != dem_hash:
                continue
            state = baseline[course_id]
            require(document["course"]["geometry"] == state["route"]["geometry"], "현재 경로와 다름")
            matches_api(document, state["analysis"], state["profile"])
        except (ValueError, TypeError, KeyError, OSError):
            continue
        sources[course_id] = (path, document)
    missing = sorted(set(baseline) - set(sources))
    require(not missing, f"현재 API 및 DEM과 일치하는 로컬 분석 JSON을 찾지 못했어요. 코스 ID: {missing}")

    output.mkdir(parents=True)
    write_json(output / "baseline-api.json", {str(key): value for key, value in baseline.items()})
    rows = []
    for course_id in range(1, 14):
        path, before = sources[course_id]
        state = baseline[course_id]
        write_json(output / "previous" / f"course-{course_id}.json", before)
        feature = {"type": "Feature", "properties": {key: value for key, value in before["course"].items()
                   if key != "geometry"}, "geometry": before["course"]["geometry"]}
        route_path = output / "routes" / f"course-{course_id}.geojson"
        write_json(route_path, feature)
        settings = before["settings"]
        result_path = output / f"course-{course_id}-steep.json"
        after = analyze_course_to_file(dem, route_path, result_path, config=AnalysisConfig(
            sample_interval_meters=settings["sample_interval_meters"], sampling_method=settings["sampling_method"],
            elevation_unit="m", vertical_reference=settings["vertical_reference"], max_samples=settings["max_samples"],
            steep_slope_threshold_percent=threshold))
        verify_new(before, after, threshold)
        # 준비 중 다른 작업자가 최신 분석을 교체했다면 이 실행 결과를 적재하지 않는다.
        require(get(f"/api/v1/courses/{course_id}/analysis") == state["analysis"], f"코스 {course_id}: 준비 중 분석 변경")
        rows.append({"courseId": course_id, "courseName": state["route"]["courseName"],
                     "previousAnalysisId": state["analysis"]["analysisId"], "sourceFile": str(path),
                     "file": str(result_path), "sha256": sha256(result_path),
                     "samples": len(after["profile"]), "qualityStatus": after["quality_status"],
                     "unitSource": after["settings"]["elevation_unit_source"],
                     "thresholdPercent": threshold,
                     "steepRatioPercent": after["summary"]["steep_section_ratio_percent"],
                     "steepDistanceMeters": after["summary"]["steep_distance_meters"],
                     "slopeAnalyzedDistanceMeters": after["summary"]["slope_analyzed_distance_meters"]})
        print(f"코스 {course_id}: samples={len(after['profile'])}, {after['quality_status']}, steep={after['summary']['steep_section_ratio_percent']}, 기존 계산값 비교 통과", flush=True)
    for course_id, state in baseline.items():
        require(get(f"/api/v1/courses/{course_id}/analysis") == state["analysis"], f"코스 {course_id}: 준비 중 분석 변경")
    report = {"readyForImport": True, "writesDatabase": False,
              "steepSlopeThresholdPercent": threshold,
              "steepSlopeMethod": "absolute_slope_gte_distance_weighted",
              "demSha256": dem_hash, "courses": rows}
    write_json(output / "summary.json", report)
    print(f"READY_JSON: {output / 'summary.json'}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    parser.add_argument("--api-base-url", default="http://localhost:8080")
    parser.add_argument("--steep-slope-threshold-percent", type=float, default=20.0)
    args = parser.parse_args()
    repo = args.repo_root.resolve()
    sys.path.insert(0, str(repo / "data-pipeline/src"))
    try:
        prepare(repo, args.output_directory.resolve(), args.api_base_url, args.steep_slope_threshold_percent)
    except (ValueError, TypeError, KeyError, OSError, HTTPError, URLError) as error:
        parser.exit(2, f"준비 중단: {error}\nDB에는 쓰지 않았습니다.\n")


if __name__ == "__main__":
    main()
