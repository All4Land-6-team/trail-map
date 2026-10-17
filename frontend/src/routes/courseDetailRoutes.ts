import type { CourseRequest } from "../types/course";
import type { CourseDetailView } from "../types/courseDetail";
import { SPOT_CATEGORIES } from "../utils/courseProfile.ts";
import { coursePaths } from "./courseRoutes.ts";

export function readCourseDetailView(hash: string): CourseDetailView {
  const params = new URLSearchParams(hash.split("?")[1] ?? "");
  const category = SPOT_CATEGORIES.find(item => item.value === params.get("category"))?.value ?? "all";
  return { tab: params.get("tab") === "spots" ? "spots" : "analysis", category,
    ...(params.get("spot") ? { spotId: params.get("spot")! } : {}) };
}
export function courseDetailPath(request: CourseRequest, view: CourseDetailView) {
  if (view.tab === "analysis") return coursePaths.detail(request);
  const params = new URLSearchParams({ tab: "spots", category: view.category });
  if (view.spotId) params.set("spot", view.spotId);
  return `${coursePaths.detail(request)}?${params}`;
}
