import { useCallback, useEffect, useState } from "react";
import { communityApi, fromSpotType, type CommunityMapSpotDto } from "../api/community";
import type { CourseSpot } from "../types/courseDetail";

const EMPTY: readonly CourseSpot[] = [];

export function toCourseMapSpots(markers: readonly CommunityMapSpotDto[], courseId: string): CourseSpot[] {
  return markers.flatMap(marker => {
    const kind = fromSpotType(marker.type);
    if (kind === "other") return [];
    return [{
      id: marker.targetType === "FACILITY" ? `facility-${marker.targetId}` : `USER_SPOT:${marker.targetId}`,
      courseId, kind, name: marker.name, coordinate: [marker.longitude, marker.latitude],
      ...(marker.targetType === "FACILITY" ? { facilityId: marker.targetId } : {}),
      communityTarget: { mountainId: String(marker.mountainId), targetType: marker.targetType,
        targetId: String(marker.targetId) },
    }];
  });
}

export function useCourseMapSpots(courseId: string, serverId: number | undefined,
  visible: boolean, filter: "all" | CourseSpot["kind"]) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; spots: CourseSpot[]; error: boolean } | null>(null);
  const key = `${courseId}/${serverId}/${attempt}`;
  useEffect(() => {
    if (!visible || serverId === undefined) return;
    const controller = new AbortController();
    void communityApi.courseSpots(String(serverId), controller.signal).then(markers => {
      if (!controller.signal.aborted) setResult({ key, spots: toCourseMapSpots(markers, courseId), error: false });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, spots: [], error: true });
    });
    return () => controller.abort();
  }, [courseId, key, serverId, visible]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const current = result?.key === key ? result : null;
  const spots = current?.spots ?? EMPTY;
  return { spots: filter === "all" ? spots : spots.filter(spot => spot.kind === filter),
    loading: visible && serverId !== undefined && current === null, failed: current?.error ?? false, retry };
}
