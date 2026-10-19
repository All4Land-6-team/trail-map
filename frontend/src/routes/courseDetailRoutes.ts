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
export function courseDetailPath(request: CourseRequest, view: CourseDetailView, returnTo?: string | null) {
  const params = new URLSearchParams();
  if (view.tab === "spots") {
    params.set("tab", "spots");
    params.set("category", view.category);
    if (view.spotId) params.set("spot", view.spotId);
  }
  if (returnTo) params.set("returnTo", returnTo);
  return `${coursePaths.detail(request)}${params.size ? `?${params}` : ""}`;
}

export function cartCourseDetailPath(request: CourseRequest, returnTo: string) {
  return courseDetailPath(request, { tab: "analysis", category: "all" }, returnTo);
}

export function courseDetailNavigationSource(returnTo?: string | null): "home" | "saved" {
  let path = returnTo;
  for (let depth = 0; path && depth < 2; depth += 1) {
    if (/^cart(?:\/|$)/.test(path)) return "saved";
    path = new URLSearchParams(path.split("?")[1] ?? "").get("returnTo");
  }
  return "home";
}
