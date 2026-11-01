import type { CourseSpotRequest } from "../types/courseDetail";
import type { CourseRequest } from "../types/course";
import { databaseCourseId } from "../utils/courseIdentity.ts";

/** 복귀 주소는 앱 내부 경로만 허용한다. */
export function internalReturnPath(value: string | null, fallback = "") {
  return value && /^(mountains\/|hikes\/|cart(?:\/|$))/.test(value) && !value.includes("#") ? value : fallback;
}

export function spotReviewPath(request: CourseSpotRequest) {
  const query = new URLSearchParams({ screen: "spotDetail", mountain: request.mountainId,
    spot: request.spotId, returnTo: request.returnPath });
  return `community?${query}`;
}

export function courseReviewPath(request: CourseRequest & { returnPath: string }) {
  // 커뮤니티는 DB 숫자 ID 또는 외부 별칭을 받으며 화면용 db- 접두사는 모른다.
  const courseId = String(databaseCourseId(request.courseId) ?? request.courseId);
  const query = new URLSearchParams({ screen: "courseReviewList", mountain: request.mountainId,
    course: courseId, returnTo: request.returnPath });
  return `community?${query}`;
}
