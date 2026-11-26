import { useCallback, useEffect, useState } from 'react';
import { communityApi, fromSpotType, type CommunityCourseSpotListDto } from '../api/community';
import type { CourseFacilitiesState, CourseSpot } from '../types/courseDetail';

export function toCourseSpotList(items: readonly CommunityCourseSpotListDto[], courseId: string): CourseSpot[] {
  return items.flatMap(item => {
    const kind = fromSpotType(item.type);
    if (kind === 'other') return [];
    return [{
      id: item.targetType === 'FACILITY' ? `facility-${item.targetId}` : `USER_SPOT:${item.targetId}`,
      courseId, kind, name: item.name, coordinate: [item.longitude, item.latitude],
      ...(item.targetType === 'FACILITY' ? { facilityId: item.targetId, distanceMeters: item.distanceMeters ?? undefined } : {}),
      photoCount: item.photoCount, reviewCount: item.reviewCount,
      communityTarget: { mountainId: String(item.mountainId), targetType: item.targetType,
        targetId: String(item.targetId) },
    }];
  });
}

export function useCourseSpotList(courseId: string, backendCourseId: number | undefined, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: CourseFacilitiesState } | null>(null);
  const key = `${courseId}/${backendCourseId}/${attempt}`;
  const connected = backendCourseId !== undefined && Number.isSafeInteger(backendCourseId) && backendCourseId > 0;

  useEffect(() => {
    if (!enabled || !connected || backendCourseId === undefined) return;
    const controller = new AbortController();
    void communityApi.courseSpotList(String(backendCourseId), controller.signal).then(items => {
      if (!controller.signal.aborted) setResult({ key, state: { status: 'success', spots: toCourseSpotList(items, courseId) } });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, state: { status: 'error',
        message: error instanceof Error ? error.message : '스팟을 불러오지 못했어요.' } });
    });
    return () => controller.abort();
  }, [backendCourseId, connected, courseId, enabled, key]);

  const state: CourseFacilitiesState = !connected ? { status: 'unavailable' }
    : result?.key === key ? result.state : { status: 'loading' };
  return { state, retry: useCallback(() => setAttempt(value => value + 1), []) };
}
