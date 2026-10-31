import { useCallback, useEffect, useState } from 'react';
import { loadCourseAnalysis } from '../../../api/courseAnalysis';
import type { Course } from '../../../types/course';
import type { CourseAnalysisState } from '../../../types/courseAnalysis';

export function useCourseAnalysis(course: Course | null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: CourseAnalysisState } | null>(null);
  const reference = course?.analysisReference;
  const key = JSON.stringify([course?.mountainId, course?.id, reference, attempt]);
  const courseId = reference?.courseId, mountainId = reference?.mountainId;
  const connected = Number.isSafeInteger(courseId) && courseId! > 0 && Number.isSafeInteger(mountainId) && mountainId! > 0;
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    loadCourseAnalysis({ courseId: courseId!, mountainId: mountainId!, development: reference?.development === true },
      { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ key, state: { status: 'success', data } });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, state: { status: 'error',
        message: error instanceof Error ? error.message : '분석을 불러오지 못했어요.' } });
    });
    return () => controller.abort();
  }, [connected, courseId, mountainId, reference?.development, key]);
  const state: CourseAnalysisState = !connected ? { status: 'unavailable', message: '이 코스에 분석용 데이터가 아직 연결되지 않았어요.' }
    : result?.key === key ? result.state : { status: 'loading' };
  return { state, retry: useCallback(() => setAttempt(value => value + 1), []) };
}
