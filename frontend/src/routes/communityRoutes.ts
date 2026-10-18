import type { CourseSpotRequest } from "../types/courseDetail";

/** 복귀 주소는 앱 내부 경로만 허용한다. */
export function internalReturnPath(value: string | null, fallback = "") {
  return value && /^(mountains\/|hikes\/|cart(?:\/|$))/.test(value) && !value.includes("#") ? value : fallback;
}

export function spotReviewPath(request: CourseSpotRequest) {
  const query = new URLSearchParams({ screen: "spotDetail", mountain: request.mountainId,
    spot: request.spotId, returnTo: request.returnPath });
  return `community?${query}`;
}
