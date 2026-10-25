import { useCallback, useEffect, useState } from 'react';
import { loadCourseRestrooms } from '../../../api/courseFacilities';
import type { CourseFacilitiesState } from '../../../types/courseDetail';
import { toCourseRestroomSpots } from '../../../utils/courseFacilities';

export function useCourseFacilities(courseId: string, backendCourseId: number | undefined, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: CourseFacilitiesState } | null>(null);
  const key = `${courseId}/${backendCourseId}/${attempt}`;
  const connected = backendCourseId !== undefined && Number.isSafeInteger(backendCourseId) && backendCourseId > 0;

  useEffect(() => {
    if (!enabled || !connected || backendCourseId === undefined) return;
    const controller = new AbortController();
    loadCourseRestrooms(backendCourseId, { signal: controller.signal }).then(facilities => {
      if (!controller.signal.aborted) {
        setResult({ key, state: { status: 'success', spots: toCourseRestroomSpots(facilities, courseId) } });
      }
    }).catch(error => {
      if (!controller.signal.aborted) {
        setResult({ key, state: { status: 'error', message: error instanceof Error ? error.message : '화장실을 불러오지 못했어요.' } });
      }
    });
    return () => controller.abort();
  }, [backendCourseId, connected, courseId, enabled, key]);

  // 코스가 바뀐 직후에도 이전 코스의 결과가 한 프레임 섞이지 않도록 요청 키를 확인한다.
  const state: CourseFacilitiesState = !connected ? { status: 'unavailable' }
    : result?.key === key ? result.state : { status: 'loading' };
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { state, retry };
}
