import type { LngLat } from "../types/hike";

// 서버(HikeRecordService)와 같은 기준으로 지도에 그릴 위치를 거른다. 저장 여부는 서버가 다시 판단한다.

/** 수평 정확도가 이보다 나쁜 위치는 경로에서 뺀다. */
export const MAX_ACCURACY_METERS = 50;
/** 직전 위치와 이보다 가까우면 제자리 GPS 흔들림으로 보고 뺀다. */
export const MIN_STEP_METERS = 5;
const EARTH_RADIUS_METERS = 6_371_008.8;

/** 하버사인 거리(m) */
export function distanceMeters([fromLng, fromLat]: LngLat, [toLng, toLat]: LngLat) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = toRadians(toLat - fromLat);
  const lngDelta = toRadians(toLng - fromLng);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(lngDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

/** 경로 길이(m). 화면에서 이동 거리를 바로 보여 줄 때 쓴다. 저장하는 이동 거리는 서버가 다시 계산한다. */
export function pathLengthMeters(path: LngLat[]) {
  let meters = 0;
  for (let index = 1; index < path.length; index++) meters += distanceMeters(path[index - 1], path[index]);
  return meters;
}

/** 이동 경로에 넣을 위치인지 판단한다. */
export function isPathPosition(previous: LngLat | undefined, next: LngLat, accuracyMeters?: number) {
  if (accuracyMeters !== undefined && accuracyMeters > MAX_ACCURACY_METERS) return false;
  return previous === undefined || distanceMeters(previous, next) >= MIN_STEP_METERS;
}


/** 현재 위치가 코스 선에서 이보다 멀면 코스에서 떨어진 거리를 알려 준다. 위치를 코스로 옮겨 그리지는 않는다. */
export const OFF_COURSE_METERS = 50;
/** 직전 진행 지점보다 이만큼 뒤 구간까지만 먼저 찾는다. 지그재그 길에서 진행 지점이 뒤로 튀지 않게 한다. */
const BACKTRACK_METERS = 100;

export type CourseProgress = {
  /** 코스 시작점부터 현재 위치를 코스 선에 옮긴 지점까지의 코스 길이 */
  alongMeters: number;
  remainingMeters: number;
  totalMeters: number;
  /** 현재 위치와 코스 선 사이 거리 */
  offCourseMeters: number;
};

type Projection = { alongMeters: number; offCourseMeters: number };

/** 선분 a→b 위에서 p와 가장 가까운 지점. 짧은 구간이라 a 기준 평면 근사로 계산한다. */
function projectOnSegment(a: LngLat, b: LngLat, p: LngLat) {
  const metersPerLat = EARTH_RADIUS_METERS * Math.PI / 180;
  const metersPerLng = metersPerLat * Math.cos(a[1] * Math.PI / 180);
  const [bx, by] = [(b[0] - a[0]) * metersPerLng, (b[1] - a[1]) * metersPerLat];
  const [px, py] = [(p[0] - a[0]) * metersPerLng, (p[1] - a[1]) * metersPerLat];
  const lengthSquared = bx * bx + by * by;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / lengthSquared));
  return { t, offCourseMeters: Math.hypot(px - t * bx, py - t * by) };
}

/**
 * 현재 위치를 코스 선의 가장 가까운 지점으로 옮겨 코스상 진행 거리·남은 거리를 구한다.
 * 코스에서 조금 벗어나도 옮긴 지점 기준이라 남은 거리가 튀지 않는다.
 * previousAlongMeters가 있으면 그 지점 근처(뒤로 BACKTRACK_METERS까지) 구간에서 먼저 찾고,
 * 그 안에서 코스를 벗어난 거리라면 코스 전체에서 다시 찾는다.
 */
export function courseProgress(route: LngLat[], position: LngLat, previousAlongMeters?: number): CourseProgress | null {
  if (route.length < 2) return null;
  const segments = route.slice(1).map((end, index) => ({ start: route[index], end, lengthMeters: distanceMeters(route[index], end) }));
  const totalMeters = segments.reduce((sum, segment) => sum + segment.lengthMeters, 0);

  let startMeters = 0;
  const candidates = segments.map(segment => {
    const { t, offCourseMeters } = projectOnSegment(segment.start, segment.end, position);
    const candidate = { alongMeters: startMeters + t * segment.lengthMeters, offCourseMeters,
      endMeters: startMeters + segment.lengthMeters };
    startMeters += segment.lengthMeters;
    return candidate;
  });
  const nearest = (list: typeof candidates): Projection | undefined =>
    list.reduce<Projection | undefined>((best, item) => !best || item.offCourseMeters < best.offCourseMeters ? item : best, undefined);

  let best = previousAlongMeters === undefined ? undefined
    : nearest(candidates.filter(item => item.endMeters >= previousAlongMeters - BACKTRACK_METERS));
  if (!best || best.offCourseMeters > OFF_COURSE_METERS) best = nearest(candidates)!;
  return { alongMeters: best.alongMeters, remainingMeters: Math.max(0, totalMeters - best.alongMeters),
    totalMeters, offCourseMeters: best.offCourseMeters };
}
