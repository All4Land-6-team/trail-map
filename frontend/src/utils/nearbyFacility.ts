import type { HikeSpot, LngLat } from "../types/hike";
import { distanceMeters } from "./hikeTracking.ts";

/** 현재 위치에서 이 거리 안에 있는 시설을 알린다. */
export const NEARBY_FACILITY_METERS = 100;

const NEARBY_TITLES: Record<HikeSpot["kind"], string> = {
  restroom: "화장실이 가까워요", water: "음수대가 가까워요", shelter: "쉼터가 가까워요", photo: "사진 스팟이 가까워요",
};

export type NearbyFacility = { id: string; title: string; detail: string };

/** 현재 위치에서 가장 가까운 시설이 100m 안이면 알림 문구. 닫은 시설은 이번 등산 동안 다시 알리지 않는다. */
export function nearbyFacility(position: LngLat | undefined, spots: HikeSpot[], dismissed: ReadonlySet<string>): NearbyFacility | null {
  if (!position) return null;
  let nearest: { spot: HikeSpot; meters: number } | null = null;
  for (const spot of spots) {
    if (dismissed.has(spot.id)) continue;
    const meters = distanceMeters(position, spot.position);
    if (meters <= NEARBY_FACILITY_METERS && (!nearest || meters < nearest.meters)) nearest = { spot, meters };
  }
  if (!nearest) return null;
  const rounded = Math.max(10, Math.round(nearest.meters / 10) * 10);
  return { id: nearest.spot.id, title: NEARBY_TITLES[nearest.spot.kind], detail: `${nearest.spot.name} · 약 ${rounded}m` };
}

