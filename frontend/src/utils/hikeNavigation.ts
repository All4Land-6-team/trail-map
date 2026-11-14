import type { LngLat } from "../types/hike";
import { courseProgress, distanceMeters } from "./hikeTracking.ts";

// 등산 중 3D 내비 모드: 진행 방향을 위로 두고 현재 위치를 따라가는 카메라에 쓰는 계산.

/** 진행 방향을 정할 때 코스에서 내다보는 거리. GPS 흔들림보다 코스 방향을 따르도록 충분히 앞을 본다. */
export const NAVIGATION_LOOK_AHEAD_METERS = 40;
/** 진행 방향을 정하기에 너무 짧은 구간 */
const MIN_HEADING_METERS = 3;

/** from에서 to를 바라보는 방위각(도, 북쪽 0·시계 방향, 0 이상 360 미만) */
export function bearingDegrees([fromLng, fromLat]: LngLat, [toLng, toLat]: LngLat) {
  const toRad = Math.PI / 180;
  const [φ1, φ2, Δλ] = [fromLat * toRad, toLat * toRad, (toLng - fromLng) * toRad];
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / toRad + 360) % 360;
}

/** 코스 시작점부터 meters만큼 코스를 따라간 지점. 범위를 벗어나면 시작점·끝점 */
export function pointAlongRoute(route: LngLat[], meters: number): LngLat | undefined {
  if (route.length === 0) return undefined;
  let remaining = Math.max(0, meters);
  for (let index = 1; index < route.length; index++) {
    const [start, end] = [route[index - 1], route[index]];
    const length = distanceMeters(start, end);
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length;
      return [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
    }
    remaining -= length;
  }
  return route[route.length - 1];
}

/** 코스를 따라 meters 지점부터 끝까지 남은 경로 */
export function routeAhead(route: LngLat[], meters: number): LngLat[] {
  const start = pointAlongRoute(route, meters);
  if (!start) return [];
  let walked = 0;
  for (let index = 1; index < route.length; index++) {
    walked += distanceMeters(route[index - 1], route[index]);
    if (walked > meters) return [start, ...route.slice(index)];
  }
  return [];
}

/** 선을 다듬을 때 지울 자잘한 꺾임의 크기(m). GPS 잔떨림·좌표 계단을 지운다. */
export const SMOOTH_TOLERANCE_METERS = 3;
/** 모서리 깎기 반복 횟수. 반복할수록 곡선이 부드러워진다. */
export const SMOOTH_ITERATIONS = 3;

/** 첫 점 기준 평면 좌표(m)로 바꾸는 함수 쌍. 등산 코스 정도의 범위에서는 오차가 작다. */
function planar(origin: LngLat) {
  const metersPerLat = 111_320;
  const metersPerLng = metersPerLat * Math.cos(origin[1] * Math.PI / 180);
  return (point: LngLat) => [(point[0] - origin[0]) * metersPerLng, (point[1] - origin[1]) * metersPerLat] as const;
}

/** 양 끝점을 남기고, 직선에서 tolerance보다 덜 벗어난 점을 지운다 (Douglas–Peucker). */
export function simplifyPath(path: LngLat[], toleranceMeters = SMOOTH_TOLERANCE_METERS): LngLat[] {
  if (path.length <= 2) return path;
  const toXY = planar(path[0]);
  const xy = path.map(toXY);
  const keep = new Array<boolean>(path.length).fill(false);
  keep[0] = keep[path.length - 1] = true;
  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = xy[first], [bx, by] = xy[last];
    const length = Math.hypot(bx - ax, by - ay);
    let farthest = -1, farthestDistance = toleranceMeters;
    for (let index = first + 1; index < last; index++) {
      const [px, py] = xy[index];
      const distance = length === 0 ? Math.hypot(px - ax, py - ay)
        : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (distance > farthestDistance) { farthest = index; farthestDistance = distance; }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return path.filter((_, index) => keep[index]);
}

/** 모서리를 1/4·3/4 지점으로 깎아 곡선으로 만든다 (Chaikin). 양 끝점은 그대로 둔다. */
export function chaikinSmooth(path: LngLat[], iterations = SMOOTH_ITERATIONS): LngLat[] {
  let result = path;
  for (let round = 0; round < iterations && result.length > 2; round++) {
    const next: LngLat[] = [result[0]];
    for (let index = 0; index < result.length - 1; index++) {
      const [a, b] = [result[index], result[index + 1]];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    next.push(result[result.length - 1]);
    result = next;
  }
  return result;
}

/** 지도에 그릴 선: 자잘한 꺾임을 지운 뒤 모서리를 깎는다. 거리·방향 계산에는 쓰지 않는다. */
export function smoothLine(path: LngLat[]): LngLat[] {
  return chaikinSmooth(simplifyPath(path));
}

/** 코스 시작점부터 meters 지점까지 지나온 경로 */
export function routeBehind(route: LngLat[], meters: number): LngLat[] {
  const end = pointAlongRoute(route, meters);
  if (!end || meters <= 0) return [];
  let walked = 0;
  for (let index = 1; index < route.length; index++) {
    walked += distanceMeters(route[index - 1], route[index]);
    if (walked >= meters) return [...route.slice(0, index), end];
  }
  return route;
}

/**
 * 현재 위치를 코스에 옮긴 지점에서 코스를 둘로 나눈다. 미리 다듬어 둔 선을 자르면
 * 위치가 바뀌어도 곡선 모양이 그대로다(자른 뒤 다듬으면 매번 모양이 달라진다).
 */
export function splitRouteAt(route: LngLat[], position: LngLat) {
  const progress = courseProgress(route, position);
  if (!progress) return { behind: [] as LngLat[], ahead: route };
  return { behind: routeBehind(route, progress.alongMeters), ahead: routeAhead(route, progress.alongMeters) };
}

/**
 * 원래 코스 기준 진행 거리(또는 코스 좌표 순번)를 다듬은 코스 기준 거리로 바꾼다.
 * 다듬은 선은 모서리를 깎아 조금 짧으므로 같은 지점을 다듬은 선에서 다시 찾는다. 진행 지점이 없으면 undefined
 */
export function progressOnSmoothRoute(route: LngLat[], smoothRoute: LngLat[], progressMeters?: number, currentIndex?: number) {
  const point = progressMeters !== undefined ? pointAlongRoute(route, progressMeters)
    : currentIndex !== undefined && currentIndex > 0 ? route[currentIndex] : undefined;
  return point ? courseProgress(smoothRoute, point)?.alongMeters : undefined;
}

export type NavigationFix = {
  /** 진행 방향 방위각. 정할 수 없으면 null (직전 방향을 유지한다) */
  bearing: number | null;
  /** 현재 위치를 코스 선에 옮긴 지점까지의 코스 길이 */
  alongMeters: number;
  /** 앞으로 갈 코스 경로 */
  ahead: LngLat[];
  /** 현재 위치를 코스 선에 옮긴 지점 */
  onCourse: LngLat;
  /** 현재 위치와 코스 선 사이 거리 */
  offCourseMeters: number;
};

/** 코스에서 이보다 멀면 현재 위치만 따라가지 않고 가장 가까운 코스 지점까지 함께 보여 준다. */
export const NAVIGATION_FAR_METERS = 200;

/**
 * 두 지점을 함께 보여 줄 카메라 중심·확대 수준. 지도가 돌아가 있어도 들어가도록 가로·세로 중 짧은 쪽에 맞추고,
 * 기울기로 먼 쪽이 줄어드는 만큼 여유를 둔다.
 */
export function cameraForTwoPoints(a: LngLat, b: LngLat, availablePixels: number, maxZoom: number, minZoom = 8) {
  const center: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const meters = Math.max(1, distanceMeters(a, b));
  const metersPerPixelAtZoom0 = 156_543.034 * Math.cos(center[1] * Math.PI / 180);
  const zoom = Math.log2(metersPerPixelAtZoom0 * Math.max(1, availablePixels) / (meters * 1.6));
  return { center, zoom: Math.min(maxZoom, Math.max(minZoom, zoom)) };
}

/**
 * 현재 위치에서 코스 진행 방향과 남은 경로를 구한다.
 * 방향은 위치를 코스에 옮긴 지점에서 lookAhead만큼 앞 지점을 본다. 끝에 다다르면 직전 구간 방향을 쓴다.
 */
export function navigationFix(route: LngLat[], position: LngLat, previousAlongMeters?: number,
  lookAheadMeters = NAVIGATION_LOOK_AHEAD_METERS): NavigationFix | null {
  const progress = courseProgress(route, position, previousAlongMeters);
  if (!progress) return null;
  const { alongMeters, totalMeters } = progress;
  const here = pointAlongRoute(route, alongMeters)!;
  let from = here;
  let to = pointAlongRoute(route, Math.min(totalMeters, alongMeters + lookAheadMeters))!;
  if (distanceMeters(from, to) < MIN_HEADING_METERS) {
    from = pointAlongRoute(route, Math.max(0, alongMeters - lookAheadMeters))!;
    to = here;
  }
  const bearing = distanceMeters(from, to) < MIN_HEADING_METERS ? null : bearingDegrees(from, to);
  return { bearing, alongMeters, ahead: routeAhead(route, alongMeters), onCourse: here, offCourseMeters: progress.offCourseMeters };
}
