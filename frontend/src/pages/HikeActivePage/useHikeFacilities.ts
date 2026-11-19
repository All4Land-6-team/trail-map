import { useEffect, useMemo, useState } from "react";
import { useScheduleCourse } from "../../hooks/useScheduleCourse";
import { loadHikeSpots, saveHikeSpots } from "../../store/hikeSessionSnapshot";
import type { HikeSession } from "../../store/hikeSessionStore";
import type { ActiveHike, HikeSpot, LngLat } from "../../types/hike";
import { nearbyFacility } from "../../utils/nearbyFacility";

/**
 * 등산 중·하산 중 화면의 코스 시설.
 * 예시 코스는 예시 스팟, 실제(DB) 코스는 시설 API에서 받은 화장실·음수대·쉼터를 쓴다.
 * 받은 시설은 기록별로 휴대폰에 저장해 통신이 끊긴 채 다시 열어도 그대로 보여 준다.
 */
export function useHikeFacilities(session: HikeSession | null, hike: ActiveHike | null | undefined): HikeSpot[] {
  const sampleSpots = hike?.spots ?? [];
  const hikeRecordId = session?.hikeRecordId;
  const course = useScheduleCourse(sampleSpots.length ? undefined : session?.schedule);
  const loaded = course?.spots;
  useEffect(() => {
    if (hikeRecordId !== undefined && loaded?.length) saveHikeSpots(hikeRecordId, loaded);
  }, [hikeRecordId, loaded]);
  const saved = useMemo(() => hikeRecordId === undefined ? [] : loadHikeSpots(hikeRecordId), [hikeRecordId]);
  if (sampleSpots.length) return sampleSpots;
  return loaded?.length ? loaded : saved;
}

/** 휴대폰 안에서 거리만 계산하므로 통신이 끊겨도 동작한다. */
export function useNearbyFacility(position: LngLat | undefined, spots: HikeSpot[]) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const nearby = useMemo(() => nearbyFacility(position, spots, dismissed), [position, spots, dismissed]);
  return nearby && { ...nearby, dismiss: () => setDismissed(previous => new Set(previous).add(nearby.id)) };
}
