import type {
  AnalysisCoverage, AnalysisMetrics, AnalysisQualityStatus, AnalysisSettings, CourseAnalysis,
  CourseAnalysisProfile, CourseComparison, LoadedCourseComparison,
} from '../types/courseAnalysis.ts';

const FORMAT_ERROR = '분석 응답이 올바르지 않아요. 다시 불러와 주세요.';
const QUALITY: readonly string[] = ['AVAILABLE', 'PARTIAL', 'NO_DATA', 'OUTDATED', 'PROCESSING', 'FAILED'];
const METRICS = ['distanceMeters', 'estimatedDurationSeconds', 'minElevationMeters', 'maxElevationMeters',
  'elevationGainMeters', 'elevationLossMeters', 'steepSectionRatioPercent'] as const;
type RequestOptions = { signal?: AbortSignal; timeoutMs?: number; apiBaseUrl?: string };
const fail = (): never => { throw new Error(FORMAT_ERROR); };
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const id = (v: unknown): v is number => number(v) && Number.isSafeInteger(v) && v > 0;
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const quality = (v: unknown): v is AnalysisQualityStatus => typeof v === 'string' && QUALITY.includes(v);
const nullableNumber = (v: unknown): v is number | null => v === null || number(v);
const percentage = (v: unknown) => number(v) && v >= 0 && v <= 100;

function data(value: unknown): unknown {
  if (!record(value) || value.success !== true || !('data' in value)) return fail();
  return value.data;
}

function parseMetrics(value: unknown): AnalysisMetrics {
  if (!record(value) || !METRICS.every(key => nullableNumber(value[key]))) return fail();
  for (const key of ['distanceMeters', 'estimatedDurationSeconds', 'elevationGainMeters', 'elevationLossMeters'] as const) {
    if (value[key] !== null && (value[key] as number) < 0) return fail();
  }
  if (value.steepSectionRatioPercent !== null && !percentage(value.steepSectionRatioPercent)) return fail();
  if (value.minElevationMeters !== null && value.maxElevationMeters !== null
    && (value.minElevationMeters as number) > (value.maxElevationMeters as number)) return fail();
  return Object.fromEntries(METRICS.map(key => [key, value[key]])) as AnalysisMetrics;
}

function parseCoverage(value: unknown): AnalysisCoverage | null {
  if (value === null) return null;
  if (!record(value)) return fail();
  const counts = ['sampleCount', 'validDemSampleCount', 'validElevationMetersSampleCount', 'analyzedSegmentCount'];
  if (!counts.every(key => number(value[key]) && Number.isSafeInteger(value[key]) && (value[key] as number) >= 0)
    || !percentage(value.sampleCoveragePercent) || !percentage(value.distanceCoveragePercent)
    || !number(value.coveredDistanceMeters) || value.coveredDistanceMeters < 0
    || (value.validDemSampleCount as number) > (value.sampleCount as number)
    || (value.validElevationMetersSampleCount as number) > (value.sampleCount as number)) return fail();
  return { ...value } as AnalysisCoverage;
}

function parseSettings(value: unknown): AnalysisSettings | null {
  if (value === null) return null;
  if (!record(value) || !number(value.sampleIntervalMeters) || value.sampleIntervalMeters <= 0
    || !['samplingMethod', 'resamplingMethod', 'distanceMethod', 'elevationUnit', 'elevationUnitSource',
      'elevationProcessing', 'slopeConvention'].every(key => text(value[key]))
    || !(value.verticalReference === null || text(value.verticalReference))) return fail();
  return { ...value } as AnalysisSettings;
}

export function parseCourseAnalysis(value: unknown): CourseAnalysis {
  if (!record(value) || !id(value.courseId) || !id(value.mountainId) || !id(value.currentCourseVersion)
    || !quality(value.qualityStatus) || !(value.recordedQualityStatus === null || quality(value.recordedQualityStatus))
    || !Array.isArray(value.qualityReasons) || !value.qualityReasons.every(text)) return fail();
  for (const key of ['analysisId', 'analyzedCourseVersion', 'demSourceId']) {
    if (!(value[key] === null || id(value[key]))) return fail();
  }
  for (const key of ['algorithmVersion', 'sourceType', 'sourceKind', 'profileUrl']) {
    if (!(value[key] === null || text(value[key]))) return fail();
  }
  if (!(value.calculatedAt === null || (text(value.calculatedAt) && Number.isFinite(Date.parse(value.calculatedAt))))) return fail();
  const metrics = parseMetrics(value.metrics);
  const coverage = parseCoverage(value.coverage);
  const settings = parseSettings(value.settings);
  if (value.analysisId === null) {
    if (value.profileUrl !== null || value.analyzedCourseVersion !== null || value.demSourceId !== null
      || coverage !== null || settings !== null || METRICS.some(key => metrics[key] !== null)
      || value.qualityStatus === 'AVAILABLE' || value.qualityStatus === 'PARTIAL' || value.qualityStatus === 'OUTDATED') return fail();
  } else if (value.profileUrl !== `/api/v1/course-analyses/${value.analysisId}/profile`
    || value.analyzedCourseVersion === null || value.demSourceId === null
    || value.algorithmVersion === null || coverage === null || settings === null) return fail();
  return { ...value, metrics, coverage, settings, qualityReasons: [...value.qualityReasons] } as CourseAnalysis;
}

function validateIds(courseIds: readonly number[]) {
  if (courseIds.length < 2 || courseIds.length > 3 || !courseIds.every(id)
    || new Set(courseIds).size !== courseIds.length) throw new Error('같은 산의 서로 다른 코스 2~3개를 선택해 주세요.');
}

export function courseComparisonUrl(courseIds: readonly number[], apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080') {
  validateIds(courseIds);
  return `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/course-comparisons?${new URLSearchParams({ courseIds: courseIds.join(',') })}`;
}

export function parseCourseComparison(value: unknown, requestedIds: readonly number[]): CourseComparison {
  validateIds(requestedIds);
  const result = data(value);
  if (!record(result) || !id(result.mountainId) || !text(result.mountainName)
    || !Array.isArray(result.courses) || result.courses.length !== requestedIds.length) return fail();
  const courses = result.courses.map((item, index) => {
    if (!record(item) || item.courseId !== requestedIds[index] || !text(item.courseName) || !id(item.currentCourseVersion)) return fail();
    const analysis = parseCourseAnalysis(item.analysis);
    if (analysis.courseId !== item.courseId || analysis.mountainId !== result.mountainId
      || analysis.currentCourseVersion !== item.currentCourseVersion) return fail();
    return { courseId: analysis.courseId, courseName: item.courseName, currentCourseVersion: item.currentCourseVersion, analysis };
  });
  return { mountainId: result.mountainId, mountainName: result.mountainName, courses };
}

export function parseCourseAnalysisProfile(value: unknown, expected: CourseAnalysis): CourseAnalysisProfile {
  const result = data(value);
  if (!record(result) || !Array.isArray(result.samples) || result.samples.length < 2 || result.samples.length > 100_000) return fail();
  const analysis = parseCourseAnalysis(result.analysis);
  // 프로필은 비교 시 선택한 불변 분석 ID의 자료여야 한다. 조회 중 코스 변경도 섞지 않는다.
  for (const key of ['courseId', 'mountainId', 'currentCourseVersion', 'analysisId', 'analyzedCourseVersion',
    'demSourceId', 'algorithmVersion', 'calculatedAt', 'sourceKind', 'sourceType', 'recordedQualityStatus', 'qualityStatus'] as const) {
    if (analysis[key] !== expected[key]) return fail();
  }
  if (analysis.analysisId === null || METRICS.some(key => analysis.metrics[key] !== expected.metrics[key])
    || !analysis.settings || !expected.settings
    || (Object.keys(expected.settings) as (keyof AnalysisSettings)[]).some(key => analysis.settings![key] !== expected.settings![key])) return fail();
  let previousDistance = -1;
  const samples = result.samples.map((item, index) => {
    if (!record(item) || item.sampleIndex !== index || !number(item.distanceMeters) || item.distanceMeters < 0
      || (index === 0 ? item.distanceMeters !== 0 : item.distanceMeters <= previousDistance)
      || !Array.isArray(item.coordinate) || item.coordinate.length !== 2
      || !number(item.coordinate[0]) || Math.abs(item.coordinate[0]) > 180
      || !number(item.coordinate[1]) || Math.abs(item.coordinate[1]) > 90
      || !nullableNumber(item.elevationMeters) || !nullableNumber(item.slopePercent) || !text(item.sampleStatus)
      || (index === 0 && item.slopePercent !== null)) return fail();
    previousDistance = item.distanceMeters;
    return { sampleIndex: index, distanceMeters: item.distanceMeters,
      coordinate: [item.coordinate[0], item.coordinate[1]] as [number, number],
      elevationMeters: item.elevationMeters, slopePercent: item.slopePercent, sampleStatus: item.sampleStatus };
  });
  if (analysis.coverage?.sampleCount !== samples.length || analysis.metrics.distanceMeters === null
    || Math.abs(previousDistance - analysis.metrics.distanceMeters) > 0.001) return fail();
  return { analysis, samples };
}

async function requestJson(url: string, { signal, timeoutMs = 10_000 }: RequestOptions): Promise<unknown> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 400) throw new Error('비교할 코스의 개수와 같은 산 소속인지 확인해 주세요.');
      if (response.status === 404) throw new Error('연결된 코스나 분석을 찾을 수 없어요. 목록에서 다시 선택해 주세요.');
      throw new Error('분석을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    const result: unknown = await response.json();
    controller.signal.throwIfAborted();
    return result;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new Error('응답이 늦어지고 있어요. 다시 시도해 주세요.');
    if (error instanceof TypeError) throw new Error('서버에 연결할 수 없어요. 연결 상태를 확인해 주세요.');
    if (error instanceof SyntaxError) throw new Error(FORMAT_ERROR);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function loadCourseComparison(courseIds: readonly number[], options: RequestOptions = {}): Promise<LoadedCourseComparison> {
  const response = await requestJson(courseComparisonUrl(courseIds, options.apiBaseUrl), options);
  const comparison = parseCourseComparison(response, courseIds);
  const courses = await Promise.all(comparison.courses.map(async course => {
    if (course.analysis.analysisId === null) return { ...course, profile: null, profileError: null };
    try {
      const profile = await loadCourseAnalysisProfile(course.analysis, options);
      return { ...course, profile, profileError: null };
    } catch (error) {
      options.signal?.throwIfAborted();
      return { ...course, profile: null, profileError: error instanceof Error ? error.message : FORMAT_ERROR };
    }
  }));
  options.signal?.throwIfAborted();
  return { ...comparison, courses };
}

export async function loadCourseAnalysisProfile(analysis: CourseAnalysis, options: RequestOptions = {}): Promise<CourseAnalysisProfile> {
  if (!id(analysis.analysisId)) throw new Error('아직 분석 프로필이 없어요.');
  const base = (options.apiBaseUrl || import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
  // 응답의 URL을 직접 열지 않고, 신뢰한 API 주소와 검증한 ID로 구성한다.
  const value = await requestJson(`${base}/api/v1/course-analyses/${analysis.analysisId}/profile`, options);
  return parseCourseAnalysisProfile(value, analysis);
}
