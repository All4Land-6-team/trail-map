import { courseFixtures } from "./courseMock";
import type { CourseRequest } from "../types/course";
import type { CourseDetailData, CourseSpot } from "../types/courseDetail";
import { coordinateAlongRoute } from "../utils/courseProfile";

// 기본 코스 정보·사진 스팟의 화면 개발용 예시. 분석 프로필은 별도 실제 API에서만 읽는다.
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
  const spots: CourseSpot[] = ready ? spotValues.map(([id, kind, name, ratio]) => ({
    id: id === "photo-1" ? "baegundae-rock" : `${course.id}-${id}`, courseId: course.id, kind, name,
    coordinate: coordinateAlongRoute(course.routeCoordinates, ratio)!,
  })) : [];
  return { course, spots };
}
