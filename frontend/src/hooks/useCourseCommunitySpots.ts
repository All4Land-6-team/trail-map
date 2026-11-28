import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadCourseCommunitySpots } from '../api/coursePhotoSpots';
import { courseSpotBounds } from '../api/communityCourseSpots';
import type { CourseFacilitiesState } from '../types/courseDetail';

/** 코스 상세 스팟 탭의 공식 시설·사용자 스팟. 커뮤니티 코스 상세와 같은 조회를 사용한다. */
export function useCourseCommunitySpots(mountainId: string, courseId: string, enabled: boolean,
  routeMountainId: number | undefined, route: readonly (readonly [number, number])[]) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: CourseFacilitiesState } | null>(null);
  const bounds = useMemo(() => courseSpotBounds(route), [route]);
  const key = JSON.stringify([mountainId, courseId, routeMountainId, bounds, attempt]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void loadCourseCommunitySpots({ mountainId, courseId }, controller.signal, routeMountainId, route).then(spots => {
      if (!controller.signal.aborted) setResult({ key, state: spots === null
        ? { status: 'unavailable' } : { status: 'success', spots } });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, state: { status: 'error',
        message: error instanceof Error && error.name !== 'TimeoutError' ? error.message : '스팟 조회가 지연되고 있어요. 다시 시도해 주세요.' } });
    });
    return () => controller.abort();
  }, [mountainId, courseId, enabled, key, routeMountainId, route]);
  const state: CourseFacilitiesState = result?.key === key ? result.state : { status: 'loading' };
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { state, retry };
}
