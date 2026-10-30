import { courseFixtures } from "./courseMock";
import type { CourseRequest } from "../types/course";
import type { CourseDetailData, CourseProfileSample, CourseSpot } from "../types/courseDetail";
import { coordinateAlongRoute } from "../utils/courseProfile";

// 실측·DEM 분석값이 아닌 화면 개발용 합성 프로필·스팟이다.
const profileValues = [
  [0, 226, 1], [0.3, 260, 7], [0.6, 350, 12], [1, 463, 10],
  [1.4, 500, 9], [1.8, 620, 15], [2.1, 750, 18], [2.4, 836, 12],
  [2.7, 650, 9], [3, 500, 11], [3.4, 380, 10], [3.8, 300, 5], [4.2, 226, 1],
] as const;
const spotValues = [
  ["photo-1", "photo", "사진 스팟 1", 0.56], ["photo-2", "photo", "사진 스팟 2", 0.85],
] as const;

export async function loadCourseDetailData(request: CourseRequest, signal: AbortSignal): Promise<CourseDetailData | null> {
  signal.throwIfAborted();
  await Promise.resolve();
  signal.throwIfAborted();
  const course = courseFixtures.find(item => item.id === request.courseId && item.mountainId === request.mountainId);
  if (!course) return null;
  const ready = course.id === "bukhansan-baegundae";
  const samples: CourseProfileSample[] = ready ? profileValues.map(([distanceKm, elevationMeters, slopePercent]) => ({
    distanceKm, elevationMeters, slopePercent,
    coordinate: coordinateAlongRoute(course.routeCoordinates, distanceKm / course.distanceKm)!,
  })) : [];
  const spots: CourseSpot[] = ready ? spotValues.map(([id, kind, name, ratio]) => ({
    id: id === "photo-1" ? "baegundae-rock" : `${course.id}-${id}`, courseId: course.id, kind, name,
    coordinate: coordinateAlongRoute(course.routeCoordinates, ratio)!,
  })) : [];
  return { course, samples, spots };
}
