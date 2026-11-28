import { communityApi, fromSpotType, type CommunitySpotDto } from './community.ts';
import { courseSpotBounds, loadCommunityCourseSpots } from './communityCourseSpots.ts';
import { isSpotHidden } from '../utils/community.ts';
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
async function resolveDatabaseCourse({ mountainId, courseId }: CourseRequest, signal: AbortSignal,
  routeMountainId: number | undefined): Promise<{ mountainId: number; courseId: number } | null> {
  const routeId = databaseCourseId(courseId);
  if (routeId !== null) return routeMountainId ? { mountainId: routeMountainId, courseId: routeId } : null;
  const mountains = await mountainApi.list(signal);
  // 다른 산을 순회하며 코스를 추측하지 않는다.
  const candidates = mountains.filter(item => String(item.mountainId) === mountainId || item.externalId === mountainId);
  if (candidates.length !== 1) return null;
  const mountain = candidates[0];
  const courses = await communityApi.courses(String(mountain.mountainId), signal);
  const matchingCourses = courses.filter(item => item.mountainId === mountain.mountainId
    && (String(item.courseId) === courseId || item.externalId === courseId));
  if (matchingCourses.length !== 1) return null;
  return { mountainId: mountain.mountainId, courseId: matchingCourses[0].courseId };
}

async function loadCourseSpots(course: CourseRequest, signal: AbortSignal, routeMountainId: number | undefined, photosOnly: boolean): Promise<CourseSpot[] | null> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  const resolved = await resolveDatabaseCourse(course, requestSignal, routeMountainId);
  return resolved && fetchSpots(resolved.courseId, resolved.mountainId, course.courseId, requestSignal, photosOnly);
}

/** 코스 상세 스팟 탭: 커뮤니티 코스 상세와 같은 커뮤니티 코스 스팟 조회로 공식 시설·사용자 스팟을 함께 가져온다. */
export async function loadCourseCommunitySpots(course: CourseRequest, signal: AbortSignal, routeMountainId: number | undefined,
  route: readonly (readonly [number, number])[]): Promise<CourseSpot[] | null> {
  if (!courseSpotBounds(route)) return null;
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  const resolved = await resolveDatabaseCourse(course, requestSignal, routeMountainId);
  if (!resolved) return null;
  const spots = await loadCommunityCourseSpots(resolved.mountainId, resolved.courseId, route, requestSignal);
  return toCourseCommunitySpots(spots, course.courseId, resolved.mountainId);
}

/**
 * 커뮤니티 스팟 응답을 코스 상세 스팟으로 바꾼다. ID는 기존 형식(`facility-{id}`, `USER_SPOT:{id}`)을 유지한다.
 * 커뮤니티 화면과 같이 반대표가 기준 이상인 스팟은 숨긴다.
 */
export function toCourseCommunitySpots(spots: readonly CommunitySpotDto[], courseId: string, mountainId: number): CourseSpot[] {
  const seen = new Set<string>();
  const users: CourseSpot[] = [];
  const facilities: CourseSpot[] = [];
  spots.forEach(spot => {
    const kind = fromSpotType(spot.type);
    const key = `${spot.targetType}:${spot.targetId}`;
    if (kind === 'other' || spot.mountainId !== mountainId || spot.status === 'HIDDEN' || seen.has(key)
      || isSpotHidden({ yes: spot.yesVotes, no: spot.noVotes, viewer: null })
      || !Number.isSafeInteger(spot.targetId) || spot.targetId <= 0
      || !Number.isFinite(spot.longitude) || Math.abs(spot.longitude) > 180
      || !Number.isFinite(spot.latitude) || Math.abs(spot.latitude) > 90) return;
    seen.add(key);
    const common = {
      courseId, kind, name: spot.name, coordinate: [spot.longitude, spot.latitude] as [number, number],
      photoCount: spot.photoCount, reviewCount: spot.reviewCount,
      communityTarget: { mountainId: String(spot.mountainId), targetType: spot.targetType, targetId: String(spot.targetId) },
    };
    if (spot.targetType === 'FACILITY') facilities.push({ ...common, id: `facility-${spot.targetId}`, facilityId: spot.targetId });
    else users.push({ ...common, id: `USER_SPOT:${spot.targetId}` });
  });
  return [...users, ...facilities];
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
