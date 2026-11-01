import { communityApi } from './community.ts';
import { databaseCourseId } from '../utils/courseIdentity.ts';
import type { CourseRequest } from '../types/course';
import type { CourseSpot } from '../types/courseDetail';

/** 시설·분석용 개발 ID 대신 DB 코스 ID 또는 커뮤니티의 외부 ID 매핑으로 실제 코스를 찾는다. */
export async function loadCoursePhotoSpots({ mountainId, courseId }: CourseRequest, signal: AbortSignal, routeMountainId?: number): Promise<CourseSpot[] | null> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  const routeId = databaseCourseId(courseId);
  if (routeId !== null) {
    if (!routeMountainId) return null;
    return fetchPhotoSpots(routeId, routeMountainId, courseId, requestSignal);
  }
  const mountains = await communityApi.mountains(requestSignal);
  // 다른 산을 순회하며 코스를 추측하지 않는다.
  const candidates = mountains.filter(item => String(item.mountainId) === mountainId || item.externalId === mountainId);
  if (candidates.length !== 1) return null;
  const mountain = candidates[0];
  const courses = await communityApi.courses(String(mountain.mountainId), requestSignal);
  const matchingCourses = courses.filter(item => item.mountainId === mountain.mountainId
    && (String(item.courseId) === courseId || item.externalId === courseId));
  if (matchingCourses.length !== 1) return null;
  const course = matchingCourses[0];
  return fetchPhotoSpots(course.courseId, mountain.mountainId, courseId, requestSignal);
}

async function fetchPhotoSpots(dbId: number, mountainId: number, courseId: string, signal: AbortSignal): Promise<CourseSpot[]> {
  const spots = await communityApi.coursePhotoSpots(String(dbId), signal);
  const ids = new Set<number>();
  return spots.map(spot => {
    if (spot.targetType !== 'USER_SPOT' || spot.type !== 'PHOTO_SPOT' || spot.mountainId !== mountainId
      || !Number.isSafeInteger(spot.targetId) || spot.targetId <= 0 || ids.has(spot.targetId)
      || !Number.isFinite(spot.longitude) || Math.abs(spot.longitude) > 180
      || !Number.isFinite(spot.latitude) || Math.abs(spot.latitude) > 90 || spot.status === 'HIDDEN') {
      throw new Error('사진 스팟 응답이 올바르지 않아요. 다시 조회해 주세요.');
    }
    ids.add(spot.targetId);
    return {
      id: `USER_SPOT:${spot.targetId}`, courseId, kind: 'photo', name: spot.name,
      coordinate: [spot.longitude, spot.latitude], photoCount: spot.photoCount, reviewCount: spot.reviewCount,
      communityTarget: { mountainId: String(spot.mountainId), targetType: 'USER_SPOT', targetId: String(spot.targetId) },
    };
  });
}
