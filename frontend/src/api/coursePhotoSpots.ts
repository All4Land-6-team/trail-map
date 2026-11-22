import { communityApi, fromSpotType } from './community.ts';
import { mountainApi } from './mountainApi.ts';
import { databaseCourseId } from '../utils/courseIdentity.ts';
import type { CourseRequest } from '../types/course';
import type { CourseSpot } from '../types/courseDetail';

export function loadCoursePhotoSpots(course: CourseRequest, signal: AbortSignal, mountainId?: number) {
  return loadCourseSpots(course, signal, mountainId, true);
}

export function loadCourseUserSpots(course: CourseRequest, signal: AbortSignal, mountainId?: number) {
  return loadCourseSpots(course, signal, mountainId, false);
}

/** 시설·분석용 개발 ID 대신 DB 코스 ID 또는 커뮤니티의 외부 ID 매핑으로 실제 코스를 찾는다. */
async function loadCourseSpots({ mountainId, courseId }: CourseRequest, signal: AbortSignal, routeMountainId: number | undefined, photosOnly: boolean): Promise<CourseSpot[] | null> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  const routeId = databaseCourseId(courseId);
  if (routeId !== null) {
    if (!routeMountainId) return null;
    return fetchSpots(routeId, routeMountainId, courseId, requestSignal, photosOnly);
  }
  const mountains = await mountainApi.list(requestSignal);
  // 다른 산을 순회하며 코스를 추측하지 않는다.
  const candidates = mountains.filter(item => String(item.mountainId) === mountainId || item.externalId === mountainId);
  if (candidates.length !== 1) return null;
  const mountain = candidates[0];
  const courses = await communityApi.courses(String(mountain.mountainId), requestSignal);
  const matchingCourses = courses.filter(item => item.mountainId === mountain.mountainId
    && (String(item.courseId) === courseId || item.externalId === courseId));
  if (matchingCourses.length !== 1) return null;
  const course = matchingCourses[0];
  return fetchSpots(course.courseId, mountain.mountainId, courseId, requestSignal, photosOnly);
}

async function fetchSpots(dbId: number, mountainId: number, courseId: string, signal: AbortSignal, photosOnly: boolean): Promise<CourseSpot[]> {
  const spots = await (photosOnly ? communityApi.coursePhotoSpots : communityApi.courseUserSpots)(String(dbId), signal);
  const ids = new Set<number>();
  return spots.map(spot => {
    const kind = fromSpotType(spot.type);
    if (!kind || kind === 'other' || spot.targetType !== 'USER_SPOT' || (photosOnly && kind !== 'photo') || spot.mountainId !== mountainId
      || !Number.isSafeInteger(spot.targetId) || spot.targetId <= 0 || ids.has(spot.targetId)
      || !Number.isFinite(spot.longitude) || Math.abs(spot.longitude) > 180
      || !Number.isFinite(spot.latitude) || Math.abs(spot.latitude) > 90 || spot.status === 'HIDDEN') {
      throw new Error('사용자 스팟 응답이 올바르지 않아요. 다시 조회해 주세요.');
    }
    ids.add(spot.targetId);
    return {
      id: `USER_SPOT:${spot.targetId}`, courseId, kind, name: spot.name,
      coordinate: [spot.longitude, spot.latitude], photoCount: spot.photoCount, reviewCount: spot.reviewCount,
      communityTarget: { mountainId: String(spot.mountainId), targetType: 'USER_SPOT', targetId: String(spot.targetId) },
    };
  });
}
