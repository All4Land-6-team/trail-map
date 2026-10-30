import { DEV_COURSE_IDS } from '../constants/hikeCourseIds.ts';
import type { AnalysisCourseReference, CourseAnalysis, CourseAnalysisProfile, CourseComparisonState } from '../types/courseAnalysis.ts';

const DEV_MOUNTAIN_IDS: Readonly<Record<string, number>> = { bukhansan: 1, dobongsan: 2, seoraksan: 3, gwanaksan: 4, jirisan: 5 };
const isId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const COMPARISON_COLORS = ['#1b6a53', '#5b8bd6', '#d9964a'] as const;

/** 선택한 최대 3개 코스의 색을 선택 화면·지도·차트·비교표에서 일치시킨다. */
export function withComparisonColors<T extends { id: string; color: string }>(courses: readonly T[], selectedIds: ReadonlySet<string>): T[] {
  let index = 0;
  return courses.map(course => selectedIds.has(course.id)
    ? { ...course, color: COMPARISON_COLORS[index++ % COMPARISON_COLORS.length] } : course);
}

/** 개발용 시드와만 연결한다. 운영 빌드와 시설 시범 DB의 별도 ID는 사용하지 않는다. */
export function developmentAnalysisReference(courseId: string, mountainId: string, enabled: boolean): AnalysisCourseReference | undefined {
  const id = DEV_COURSE_IDS[courseId];
  const mountain = DEV_MOUNTAIN_IDS[mountainId];
  return enabled && isId(id) && isId(mountain) ? { courseId: id, mountainId: mountain, development: true } : undefined;
}

type CourseReference = { id: string; analysisReference?: AnalysisCourseReference };
export function comparisonRequest(courses: readonly CourseReference[]):
  { connected: true; courseIds: number[]; mountainId: number } | { connected: false; message: string } {
  if (courses.length < 2 || courses.length > 3 || new Set(courses.map(c => c.id)).size !== courses.length) {
    return { connected: false, message: '서로 다른 코스 2~3개를 선택해 주세요.' };
  }
  if (courses.some(c => !isId(c.analysisReference?.courseId) || !isId(c.analysisReference?.mountainId))) {
    return { connected: false, message: '선택한 코스에 분석용 데이터가 아직 연결되지 않았어요.' };
  }
  const references = courses.map(c => c.analysisReference!);
  if (new Set(references.map(r => r.courseId)).size !== courses.length) {
    return { connected: false, message: '코스 데이터 연결을 확인해야 해요. 목록에서 다시 선택해 주세요.' };
  }
  if (new Set(references.map(r => r.mountainId)).size !== 1) {
    return { connected: false, message: '같은 산의 코스만 비교할 수 있어요.' };
  }
  return { connected: true, courseIds: references.map(r => r.courseId), mountainId: references[0].mountainId };
}

export type ComparisonCourseView = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  development: boolean;
  analysis: CourseAnalysis | null;
  profile: CourseAnalysisProfile | null;
  profileError: string | null;
};
type ViewInput = CourseReference & { name: string; shortName: string; color: string };

export function comparisonCourseViews(courses: readonly ViewInput[], state: CourseComparisonState): ComparisonCourseView[] {
  return courses.map(course => {
    const loaded = state.status === 'success'
      ? state.data.courses.find(item => item.courseId === course.analysisReference?.courseId) : undefined;
    return { id: course.id, name: loaded?.courseName ?? course.name,
      shortName: loaded?.courseName.replace(/ 코스$/, '') ?? course.shortName, color: course.color,
      development: course.analysisReference?.development === true || loaded?.analysis.sourceKind === 'development',
      analysis: loaded?.analysis ?? null, profile: loaded?.profile ?? null, profileError: loaded?.profileError ?? null };
  });
}

export function formatAnalysisDistance(meters: number | null | undefined): string {
  return meters == null ? '—' : `${(meters / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })} km`;
}

export function formatAnalysisDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes}분` : `${hours}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}`;
}

/** 결측은 축 범위에서만 제외하고 series에는 남겨 선을 끊는다. 큰 프로필도 spread 없이 처리한다. */
export function elevationAxisBounds(series: readonly { points: readonly { distanceKm: number; elevationMeters: number | null }[] }[]) {
  let distance = 0, min = Infinity, max = -Infinity;
  for (const item of series) for (const point of item.points) {
    distance = Math.max(distance, point.distanceKm);
    if (point.elevationMeters !== null) { min = Math.min(min, point.elevationMeters); max = Math.max(max, point.elevationMeters); }
  }
  if (min === Infinity) return { distanceMax: Math.max(0.1, Math.ceil(distance * 10) / 10), elevationMin: 0, elevationMax: 100 };
  const padding = Math.max(5, (max - min) * 0.08);
  return { distanceMax: Math.max(0.1, Math.ceil(distance * 10) / 10),
    elevationMin: Math.floor((min - padding) / 10) * 10, elevationMax: Math.ceil((max + padding) / 10) * 10 };
}

const QUALITY_LABELS = { AVAILABLE: '분석 있음', PARTIAL: '확인 필요', NO_DATA: '분석 없음', OUTDATED: '이전 분석', PROCESSING: '분석 중', FAILED: '분석 실패' };
export function analysisQualityLabel(analysis: CourseAnalysis | null) {
  return analysis ? QUALITY_LABELS[analysis.qualityStatus] : '조회 전';
}
const REASONS: Readonly<Record<string, string>> = {
  UNVERIFIED_VERTICAL_REFERENCE: '고도의 수직 기준을 확인하지 못했어요.',
  UNKNOWN_ELEVATION_UNIT: '고도 단위가 확인되지 않았어요.',
  UNVERIFIED_ELEVATION_UNIT: '고도 단위가 확인되지 않았어요.',
  ANALYSIS_NOT_FOUND: '아직 저장된 분석이 없어요.',
  MISSING_DEM_SAMPLES: '일부 구간의 고도 데이터가 없어요.',
  NO_CONTIGUOUS_METRIC_HEIGHT_SEGMENTS: '연속된 고도가 없어 구간 경사와 상승·하강량을 계산하지 못했어요.',
  COURSE_VERSION_CHANGED: '분석 이후 코스 버전이 변경됐어요.',
  COURSE_GEOMETRY_CHANGED: '분석 이후 코스 경로가 변경됐어요.',
  COURSE_MOUNTAIN_CHANGED: '분석 이후 코스의 소속 산이 변경됐어요.',
  COURSE_SOURCE_CHANGED: '분석 이후 코스의 출처가 변경됐어요.',
  DEM_OUT_OF_BOUNDS: '일부 경로가 고도 데이터 범위를 벗어나요.',
  DEM_NODATA: '일부 구간의 고도 데이터가 없어요.',
};
export function analysisQualityReasons(analysis: CourseAnalysis): string[] {
  const messages = analysis.qualityReasons.map(reason => REASONS[reason] ?? '일부 분석 조건이나 데이터에 추가 확인이 필요해요.');
  if (analysis.qualityStatus === 'OUTDATED') messages.unshift('코스가 변경되어 현재 경로와 다른 분석일 수 있어요.');
  if (analysis.settings?.elevationUnitSource === 'caller_declaration') messages.push('고도 단위는 분석 시 지정한 값이에요.');
  return [...new Set(messages)];
}
