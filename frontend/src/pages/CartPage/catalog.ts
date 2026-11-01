import { courseFixtures } from "../../api/courseMock";
import { mountains } from "../../api/homeMock";
import { savedCourses } from "./data";
import type { CartCourse } from "./types";
import type { Course } from "../../types/course";
import { getSavedCourse } from "../../store/courseSelectionStore";

// 탐색 화면의 ID를 유지하고, 기존 비교 시안에 있는 분석값만 재사용한다.
export function toCartCourse(course: Course, index: number): CartCourse {
  const example = course.routeSource ? undefined : savedCourses.find(item => item.id === course.id);
  return {
    id: course.id, mountainId: course.mountainId, name: course.name, shortName: course.name.replace(/ 코스$/, ""),
    analysisReference: course.analysisReference,
    scheduleAvailable: !course.routeSource,
    mountain: mountains.find(item => item.id === course.mountainId)?.name ?? "산",
    distanceKm: course.distanceKm, durationMinutes: course.durationMinutes,
    routeCoordinates: course.routeCoordinates, color: example?.color ?? ["#1b6a53", "#5b8bd6", "#d9964a"][index % 3],
    averageSlopePercent: example?.averageSlopePercent, elevationProfile: example?.elevationProfile ?? [],
  };
}

export const cartCatalog: readonly CartCourse[] = courseFixtures.map(toCartCourse);

export function getSavedCartCourses(ids: readonly string[]): CartCourse[] {
  return ids.flatMap((id, index) => {
    const course = getSavedCourse(id);
    const entry = course ? toCartCourse(course, index) : cartCatalog.find(item => item.id === id);
    return entry ? [entry] : [];
  });
}
