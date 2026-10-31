import type { Course } from '../types/course.ts';
import type { CourseAnalysisState } from '../types/courseAnalysis.ts';
import type { CourseProfileSample } from '../types/courseDetail.ts';

/** API에 없는 값은 기본 정보의 예시 수치나 좌표로 보충하지 않는다. */
export function detailAnalysisView(course: Course | null, state: CourseAnalysisState) {
  const loaded = state.status === 'success' ? state.data : null;
  const samples: CourseProfileSample[] = loaded?.profile?.samples.map(point => ({
    distanceKm: point.distanceMeters / 1000, elevationMeters: point.elevationMeters,
    slopePercent: point.slopePercent, coordinate: point.coordinate,
  })) ?? [];
  return {
    analysis: loaded?.analysis ?? null, samples,
    routeCoordinates: samples.map(point => point.coordinate),
    development: course?.analysisReference?.development === true || loaded?.analysis.sourceKind === 'development',
  };
}

export function formatProfileValue(value: number | null | undefined, unit: string, digits = 1) {
  return value == null || !Number.isFinite(value) ? '—'
    : value.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + (unit === '%' ? '' : ' ') + unit;
}

/** 100,000개 샘플도 spread 없이 처리하며, 결측값은 축 계산에서만 제외한다. */
export function courseProfileAxes(samples: readonly CourseProfileSample[]) {
  let distanceMax = 0, elevationMin = Infinity, elevationMax = -Infinity, slopeMin = Infinity, slopeMax = -Infinity;
  for (const point of samples) {
    distanceMax = Math.max(distanceMax, point.distanceKm);
    if (point.elevationMeters !== null && Number.isFinite(point.elevationMeters)) {
      elevationMin = Math.min(elevationMin, point.elevationMeters);
      elevationMax = Math.max(elevationMax, point.elevationMeters);
    }
    if (point.slopePercent !== null && Number.isFinite(point.slopePercent)) {
      slopeMin = Math.min(slopeMin, point.slopePercent);
      slopeMax = Math.max(slopeMax, point.slopePercent);
    }
  }
  const elevationPadding = Math.max(5, (elevationMax - elevationMin) * 0.08);
  const slopePadding = Math.max(1, (slopeMax - slopeMin) * 0.08);
  return {
    distanceMax: Math.max(0.1, distanceMax),
    elevationMin: elevationMin === Infinity ? 0 : Math.floor((elevationMin - elevationPadding) / 10) * 10,
    elevationMax: elevationMax === -Infinity ? 100 : Math.ceil((elevationMax + elevationPadding) / 10) * 10,
    slopeMin: slopeMin === Infinity || slopeMin >= 0 ? 0 : Math.floor((slopeMin - slopePadding) / 5) * 5,
    slopeMax: slopeMax === -Infinity ? 20 : slopeMax <= 0 ? (slopeMin < 0 ? 0 : 5) : Math.ceil((slopeMax + slopePadding) / 5) * 5,
  };
}
