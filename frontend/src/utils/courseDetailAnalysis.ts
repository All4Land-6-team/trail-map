import type { Course } from '../types/course.ts';
import type { CourseAnalysisState } from '../types/courseAnalysis.ts';
import type { CourseProfileSample } from '../types/courseDetail.ts';

/** 실제 경로 API의 선은 분석과 독립적으로 유지한다. 예시 좌표로 보충하지 않는다. */
export function detailAnalysisView(course: Course | null, state: CourseAnalysisState) {
  const loaded = state.status === 'success' ? state.data : null;
  const samples: CourseProfileSample[] = loaded?.profile?.samples.map(point => ({
    distanceKm: point.distanceMeters / 1000, elevationMeters: point.elevationMeters,
    slopePercent: point.slopePercent, coordinate: point.coordinate,
  })) ?? [];
  return {
    analysis: loaded?.analysis ?? null, samples,
    routeCoordinates: course?.routeSource ? course.routeCoordinates : samples.map(point => point.coordinate),
    development: course?.analysisReference?.development === true || loaded?.analysis.sourceKind === 'development',
  };
}

export function formatProfileValue(value: number | null | undefined, unit: string, digits = 1) {
  return value == null || !Number.isFinite(value) ? '—'
    : value.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + (unit === '%' ? '' : ' ') + unit;
}

export function detailRouteLabel(course: Course, state: CourseAnalysisState, view: ReturnType<typeof detailAnalysisView>) {
  if (course.routeSource) return null;
  if (state.status === 'loading') return '분석 경로 조회 중';
  if (!view.samples.length) return '분석 경로 없음';
  return view.development ? '개발용 예시 경로' : null;
}

/** 100,000개 샘플도 spread 없이 처리하며, 결측값은 축 계산에서만 제외한다. */
export function courseProfileAxes(samples: readonly CourseProfileSample[], slopeValues?: readonly (number | null)[]) {
  let distanceMax = 0, elevationMin = Infinity, elevationMax = -Infinity, slopeMin = Infinity, slopeMax = -Infinity;
  for (const point of samples) {
    distanceMax = Math.max(distanceMax, point.distanceKm);
    if (point.elevationMeters !== null && Number.isFinite(point.elevationMeters)) {
      elevationMin = Math.min(elevationMin, point.elevationMeters);
      elevationMax = Math.max(elevationMax, point.elevationMeters);
    }
    if (!slopeValues && point.slopePercent !== null && Number.isFinite(point.slopePercent)) {
      slopeMin = Math.min(slopeMin, point.slopePercent);
      slopeMax = Math.max(slopeMax, point.slopePercent);
    }
  }
  if (slopeValues) for (const value of slopeValues) {
    if (value !== null && Number.isFinite(value)) {
      slopeMin = Math.min(slopeMin, value);
      slopeMax = Math.max(slopeMax, value);
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

export type SlopeSection = { startKm: number; endKm: number; slopePercent: number };

/** 표시 전용 구간 요약. 원본의 부호 있는 경사를 거리로 가중하며 결측 전후는 합치지 않는다. */
export function summarizeProfileSlope(samples: readonly CourseProfileSample[], intervalMeters = 50): SlopeSection[] {
  if (!Number.isFinite(intervalMeters) || intervalMeters <= 0) throw new RangeError('구간 길이는 양수여야 합니다.');
  const sections: SlopeSection[] = [];
  let start = 0, end = 0, weighted = 0, length = 0;
  const flush = () => {
    if (length > 0) sections.push({ startKm: start / 1000, endKm: end / 1000, slopePercent: weighted / length });
    weighted = 0; length = 0;
  };
  for (let i = 1; i < samples.length; i++) {
    const before = samples[i - 1], after = samples[i];
    let from = before.distanceKm * 1000;
    const to = after.distanceKm * 1000, slope = after.slopePercent;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from
      || slope === null || !Number.isFinite(slope)
      || before.elevationMeters === null || after.elevationMeters === null
      || !Number.isFinite(before.elevationMeters) || !Number.isFinite(after.elevationMeters)) {
      flush(); continue;
    }
    while (from < to) {
      // 정수 경계의 부동소수점 오차로 길이 0인 구간을 반복 생성하지 않는다.
      const boundary = (Math.floor((from + 1e-7) / intervalMeters) + 1) * intervalMeters;
      const until = Math.min(to, boundary);
      if (length === 0) start = from;
      weighted += slope * (until - from);
      length += until - from;
      end = until;
      from = until;
      if (boundary - until < 1e-7) flush();
    }
  }
  flush();
  return sections;
}

/** 선택한 원본 위치가 속한 표시 구간. 경계에서는 바로 앞 구간(선택 샘플의 경사 방향)을 쓴다. */
export function profileSlopeSectionAt(sections: readonly SlopeSection[], distanceKm: number): SlopeSection | null {
  let low = 0, high = sections.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sections[middle].endKm < distanceKm) low = middle + 1;
    else high = middle;
  }
  const section = sections[low];
  return section && section.startKm <= distanceKm ? section : null;
}

export function profileSlopeDirection(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '경사 정보 없음' : value > 0 ? '오르막' : value < 0 ? '내리막' : '평지';
}
