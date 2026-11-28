import type { CourseRequest } from "../types/course";
import type { CourseDetailView, CourseFoodPlace, CourseSpot } from "../types/courseDetail";
import { SPOT_CATEGORIES } from "../utils/courseProfile.ts";
import { coursePaths } from "./courseRoutes.ts";

export function readCourseDetailView(hash: string): CourseDetailView {
  const params = new URLSearchParams(hash.split("?")[1] ?? "");
  const category = SPOT_CATEGORIES.find(item => item.value === params.get("category"))?.value ?? "all";
  const tab = params.get("tab") === "spots" ? "spots" : "analysis";
  const spotId = params.get("spot") || undefined;
  const foodName = params.get("foodName")?.trim();
  const foodKind = params.get("foodKind");
  const longitude = Number(params.get("foodLng"));
  const latitude = Number(params.get("foodLat"));
  const foodPlace = tab === "spots" && category === "food" && spotId && foodName
    && (foodKind === "restaurant" || foodKind === "cafe")
    && Number.isFinite(longitude) && Number.isFinite(latitude)
    ? { id: spotId, name: foodName, kind: foodKind, coordinate: [longitude, latitude] } satisfies CourseFoodPlace
    : undefined;
  return { tab, category, ...(spotId ? { spotId } : {}), ...(foodPlace ? { foodPlace } : {}) };
}
export function courseDetailPath(request: CourseRequest, view: CourseDetailView, returnTo?: string | null) {
  const params = new URLSearchParams();
  const foodPlace = view.foodPlace;
  if (view.tab === "spots") {
    params.set("tab", "spots");
    params.set("category", view.category);
    if (view.spotId) params.set("spot", view.spotId);
    if (view.category === "food" && foodPlace && foodPlace.id === view.spotId) {
      params.set("foodName", foodPlace.name);
      params.set("foodKind", foodPlace.kind);
      params.set("foodLng", String(foodPlace.coordinate[0]));
      params.set("foodLat", String(foodPlace.coordinate[1]));
    }
  }
  if (returnTo) params.set("returnTo", returnTo);
  return `${coursePaths.detail(request)}${params.size ? `?${params}` : ""}`;
}

export function courseFoodDetailPath(request: CourseRequest, foodPlace: CourseFoodPlace, returnTo?: string | null) {
  return courseDetailPath(request, { tab: "spots", category: "food", spotId: foodPlace.id, foodPlace }, returnTo);
}

/** 코스 상세 `스팟·통제정보` 탭의 전체 필터에서 해당 스팟이 선택된 경로를 만든다. */
export function courseSpotDetailPath(request: CourseRequest, spot: Pick<CourseSpot, "id">, returnTo?: string | null) {
  return courseDetailPath(request, { tab: "spots", category: "all", spotId: spot.id }, returnTo);
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
