import { useCallback, useEffect, useMemo, useState } from 'react';
import { comparisonGuideRequest, loadCourseComparisonGuides } from '../../../api/courseComparisonGuides';
import type { CourseGuideComparisonState, GuideCourseReference } from '../../../types/courseGuide';

export function useCourseComparisonGuides(courses: readonly GuideCourseReference[]) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: CourseGuideComparisonState } | null>(null);
  const references = JSON.stringify(courses.map(course => ({
    id: course.id, mountainId: course.mountainId, analysisReference: course.analysisReference,
  })));
  const requestCourses: GuideCourseReference[] = useMemo(() => JSON.parse(references), [references]);
  const request = useMemo(() => comparisonGuideRequest(requestCourses), [requestCourses]);
  const key = `${references}/${attempt}`;

  useEffect(() => {
    if (!request.connected) return;
    const controller = new AbortController();
    loadCourseComparisonGuides(requestCourses, controller.signal).then(courses => {
      if (!controller.signal.aborted) setResult({ key, state: { status: 'success', courses } });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, state: { status: 'error', message: '공식 안내 정보를 불러오지 못했어요.' } });
    });
    return () => controller.abort();
  }, [key, request, requestCourses]);

  const state: CourseGuideComparisonState = !request.connected ? { status: 'unavailable', message: request.message }
    : result?.key === key ? result.state : { status: 'loading' };
  return { state, retry: useCallback(() => setAttempt(value => value + 1), []) };
}
