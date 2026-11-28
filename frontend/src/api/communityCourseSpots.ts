import { communityApi, type CommunitySpotBounds } from './community.ts';

/** 코스 연결 거리(30m)보다 넉넉하게 경로 영역을 넓혀, 코스에 연결된 스팟이 조회 영역에서 잘리지 않게 한다. */
export const COURSE_SPOT_BOUNDS_MARGIN_DEGREES = 0.01;

/** 코스 경로 전체를 감싸는 조회 영역. 지도 화면 영역과 관계없이 코스 기준으로 같은 스팟을 조회한다. */
export function courseSpotBounds(route: readonly (readonly [number, number])[],
  margin = COURSE_SPOT_BOUNDS_MARGIN_DEGREES): CommunitySpotBounds | null {
  const points = route.filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude)
    && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90);
  if (!points.length) return null;
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  return {
    west: Math.max(-180, Math.min(...longitudes) - margin), south: Math.max(-90, Math.min(...latitudes) - margin),
    east: Math.min(180, Math.max(...longitudes) + margin), north: Math.min(90, Math.max(...latitudes) + margin),
  };
}

/**
 * 커뮤니티 코스 스팟 조회(`/v1/community/mountains/{mountainId}/spots?courseId=`)로 코스에 연결된
 * 공식 시설·사용자 스팟을 조회한다. 커뮤니티 코스 상세와 코스 상세 스팟 탭이 함께 사용한다.
 */
export function loadCommunityCourseSpots(mountainId: number, courseId: number,
  route: readonly (readonly [number, number])[], signal?: AbortSignal) {
  const bounds = courseSpotBounds(route);
  if (!bounds) return Promise.reject(new Error('코스 경로가 없어 스팟을 조회할 수 없어요.'));
  return communityApi.courseSpots(String(mountainId), String(courseId), bounds, signal);
}
