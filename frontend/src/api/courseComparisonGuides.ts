import { hasRouteCatalog, parseCourseRoute, requestCourseRoutes } from './courseRoutes';
import type { CourseGuideResult, GuideCourseReference } from '../types/courseGuide';
import { databaseCourseId } from '../utils/courseIdentity';

type GuideRequest = { id: string; courseId: number; mountainId: number; mountainKey: string };
const positiveId = (value: number) => Number.isSafeInteger(value) && value > 0;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** 개발용 시드 ID를 실제 공식 안내로 해석하지 않는다. */
export function comparisonGuideRequest(courses: readonly GuideCourseReference[]):
  { connected: true; courses: GuideRequest[] } | { connected: false; message: string } {
  if (courses.length < 2 || courses.length > 3 || new Set(courses.map(course => course.id)).size !== courses.length) {
    return { connected: false, message: '서로 다른 코스 2~3개를 선택해 주세요.' };
  }
  const requests: GuideRequest[] = [];
  for (const course of courses) {
    const courseId = databaseCourseId(course.id);
    const reference = course.analysisReference;
    if (courseId === null || !course.mountainId || !hasRouteCatalog(course.mountainId)
      || !reference || reference.development || reference.courseId !== courseId || !positiveId(reference.mountainId)) {
      return { connected: false, message: '선택한 코스에 공식 안내 시간이 아직 연결되지 않았어요.' };
    }
    requests.push({ id: course.id, courseId, mountainId: reference.mountainId, mountainKey: course.mountainId });
  }
  if (new Set(requests.map(course => course.mountainId)).size !== 1
    || new Set(requests.map(course => course.mountainKey)).size !== 1) {
    return { connected: false, message: '같은 산의 코스만 비교할 수 있어요.' };
  }
  return { connected: true, courses: requests };
}

/** 분석 API와 독립적으로 현재 경로 API의 버전·지문 검증을 통과한 안내만 읽는다. */
export async function loadCourseComparisonGuides(courses: readonly GuideCourseReference[], signal: AbortSignal): Promise<CourseGuideResult[]> {
  signal.throwIfAborted();
  const request = comparisonGuideRequest(courses);
  if (!request.connected) throw new Error(request.message);
  const results = await Promise.all(request.courses.map(async (expected): Promise<CourseGuideResult> => {
    try {
      const response = await requestCourseRoutes(`courses/${expected.courseId}/route`, signal);
      signal.throwIfAborted();
      if (!record(response) || response.success !== true || !record(response.data)) throw new Error('공식 안내 응답 형식');
      const course = parseCourseRoute(response.data, expected.mountainKey, expected.courseId);
      if (course.backendCourseId !== expected.courseId
        || course.analysisReference?.mountainId !== expected.mountainId || !positiveId(course.courseVersion ?? 0)) {
        throw new Error('코스 연결 정보 불일치');
      }
      const durationSeconds = response.data.durationSeconds;
      if (!course.guide || durationSeconds === null || durationSeconds === 0) {
        return { id: expected.id, status: 'missing', message: '공식 안내 시간 정보가 없어요.' };
      }
      if (typeof durationSeconds !== 'number' || !positiveId(durationSeconds)) throw new Error('공식 안내 시간 단위');
      return { id: expected.id, status: 'available', guide: {
        courseId: expected.courseId, mountainId: expected.mountainId, courseVersion: course.courseVersion!,
        durationSeconds,
        routeLabel: course.guide.routeLabel, sourceUrl: course.guide.sourceUrl, checkedOn: course.guide.checkedOn,
      } };
    } catch {
      signal.throwIfAborted();
      return { id: expected.id, status: 'error', message: '공식 안내 정보를 불러오지 못했어요.' };
    }
  }));
  signal.throwIfAborted();
  return results;
}
