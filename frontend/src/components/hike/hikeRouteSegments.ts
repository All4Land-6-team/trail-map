import type { MapRoute } from "../map/BaseMap";
import type { LngLat } from "../../types/hike";
import { splitRouteAtMeters } from "../../utils/hikeTracking.ts";

export type HikeStage = "ascent" | "descent";

export const GRAY_ROUTE_COLOR = "#a6b1a9";
export const COURSE_ROUTE_COLOR = "#19765b";

/**
 * 등산·하산 모두 지나온 구간은 회색, 앞으로 갈 구간은 원래 색이다.
 * 내비 모드에서 가야 할 길이 눈에 띄도록 하산도 등산과 같은 규칙을 쓴다.
 */
export function hikeRouteColors(_stage: HikeStage) {
  return { completed: GRAY_ROUTE_COLOR, pending: COURSE_ROUTE_COLOR };
}

export function buildHikeRouteSegments(route: LngLat[], stage: HikeStage,
  progressMeters?: number, currentIndex?: number): MapRoute[] {
  const colors = hikeRouteColors(stage);
  if (progressMeters !== undefined) {
    const { completed, pending } = splitRouteAtMeters(route, progressMeters);
    return [
      ...(completed.length > 1 ? [{ id: "hike-traveled", color: colors.completed, coordinates: completed }] : []),
      ...(pending.length > 1 ? [{ id: "hike-remaining", color: colors.pending, coordinates: pending }] : []),
    ];
  }
  const index = currentIndex ?? 0;
  return [
    ...(currentIndex !== undefined && index > 0
      ? [{ id: "hike-traveled", color: colors.completed, coordinates: route.slice(0, index + 1) }] : []),
    { id: "hike-remaining", color: colors.pending, coordinates: route.slice(index) },
  ];
}
