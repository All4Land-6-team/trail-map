import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadCourseComparison } from '../../../api/courseAnalysis';
import type { CourseComparisonState } from '../../../types/courseAnalysis';
import { comparisonRequest } from '../../../utils/courseComparison';
import type { CartCourse } from '../types';

export function useCourseComparison(courses: readonly CartCourse[]) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: CourseComparisonState } | null>(null);
  const references = JSON.stringify(courses.map(c => ({ id: c.id, analysisReference: c.analysisReference })));
  const request = useMemo(() => comparisonRequest(JSON.parse(references)), [references]);
  const key = `${references}/${attempt}`;

  useEffect(() => {
    if (!request.connected) return;
    const controller = new AbortController();
    loadCourseComparison(request.courseIds, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      if (data.mountainId !== request.mountainId) throw new Error('연결된 산과 분석 결과가 달라요. 코스 데이터를 확인해 주세요.');
      setResult({ key, state: { status: 'success', data } });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, state: { status: 'error',
        message: error instanceof Error ? error.message : '분석을 불러오지 못했어요.' } });
    });
    return () => controller.abort();
  }, [key, request]);

  const state: CourseComparisonState = !request.connected ? { status: 'unavailable', message: request.message }
    : result?.key === key ? result.state : { status: 'loading' };
  return { state, retry: useCallback(() => setAttempt(value => value + 1), []) };
}
