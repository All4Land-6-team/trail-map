import type { ActiveHike, HikeCourse } from "../types/hike";

/** GPS 기록 연동 전에는 선택한 경로만 연결하고 임의의 진행 거리를 만들지 않는다. */
export function initialHikeProgress(course: HikeCourse, descending = false): ActiveHike {
  return { mountainName: course.mountainName, courseName: course.courseName,
    route: descending ? [...course.route].reverse() : course.route,
    currentIndex: 0, peak: course.route.at(-1)!, traveledKm: 0,
    remainingKm: course.distanceKm, sunset: course.sunset, spots: course.spots };
}
