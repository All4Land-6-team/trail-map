import { useCallback, useEffect, useState } from 'react';
import { loadCoursePhotoSpots } from '../../../api/coursePhotoSpots';
import type { CourseFacilitiesState } from '../../../types/courseDetail';

export function useCoursePhotoSpots(mountainId: string, courseId: string, enabled: boolean, routeMountainId?: number) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: CourseFacilitiesState } | null>(null);
  const key = JSON.stringify([mountainId, courseId, routeMountainId, attempt]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void loadCoursePhotoSpots({ mountainId, courseId }, controller.signal, routeMountainId).then(spots => {
      if (!controller.signal.aborted) setResult({ key, state: spots === null
        ? { status: 'unavailable' } : { status: 'success', spots } });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, state: { status: 'error',
        message: error instanceof Error && error.name !== 'TimeoutError' ? error.message : '사진 스팟 조회가 지연되고 있어요. 다시 시도해 주세요.' } });
    });
    return () => controller.abort();
  }, [mountainId, courseId, enabled, key, routeMountainId]);
  const state: CourseFacilitiesState = result?.key === key ? result.state : { status: 'loading' };
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { state, retry };
}
