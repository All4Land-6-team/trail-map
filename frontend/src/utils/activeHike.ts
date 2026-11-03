import type { ActiveHike, HikeCourse, HikeSchedule, LngLat } from "../types/hike";

/** 예시 데이터에 없는 코스: 일정 이름과 등산 기록의 코스 경로(시작점 → 정상)로 화면 정보를 만든다. 시설 스팟·일몰은 없다. */
export function sessionHikeProgress(schedule: HikeSchedule, coursePath: LngLat[], descending = false): ActiveHike | null {
  if (coursePath.length < 2) return null;
  return { mountainName: schedule.mountainName, courseName: schedule.courseName,
    route: descending ? [...coursePath].reverse() : coursePath,
    currentIndex: 0, peak: coursePath[coursePath.length - 1], traveledKm: 0,
    remainingKm: schedule.distanceKm, sunset: "정보 없음", spots: [] };
}

/** 예시 코스가 있으면 예시 코스, 없으면 등산 기록의 코스 경로로 등산 중·하산 중 화면 정보를 만든다. */
export function activeHikeFor(course: HikeCourse | undefined, schedule: HikeSchedule | undefined,
  coursePath: LngLat[] | undefined, descending: boolean) {
  if (course) return initialHikeProgress(course, descending);
  return schedule && coursePath ? sessionHikeProgress(schedule, coursePath, descending) : null;
}

/** GPS 기록 연동 전에는 선택한 경로만 연결하고 임의의 진행 거리를 만들지 않는다. */
export function initialHikeProgress(course: HikeCourse, descending = false): ActiveHike {
  return { mountainName: course.mountainName, courseName: course.courseName,
    route: descending ? [...course.route].reverse() : course.route,
    currentIndex: 0, peak: course.route.at(-1)!, traveledKm: 0,
    remainingKm: course.distanceKm, sunset: course.sunset, spots: course.spots };
}

/** 코스 경로 API 응답에서 LineString 좌표만 꺼낸다. 형식이 맞지 않으면 빈 배열 */
export function routeFromResponse(response: unknown): LngLat[] {
  const coordinates = (response as { data?: { geometry?: { coordinates?: unknown } } } | null)?.data?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  const route = coordinates.filter((point): point is LngLat => Array.isArray(point) && point.length >= 2
    && Number.isFinite(point[0]) && Number.isFinite(point[1])).map(([longitude, latitude]) => [longitude, latitude] as LngLat);
  return route.length >= 2 ? route : [];
}
