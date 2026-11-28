import { useMemo } from "react";
import { useCourseCommunitySpots } from "./useCourseCommunitySpots";
import type { CourseSpot } from "../types/courseDetail";

const EMPTY: readonly CourseSpot[] = [];
const EMPTY_ROUTE: readonly [number, number][] = [];

/** 홈 코스 목록 지도의 스팟. 코스 상세·커뮤니티 코스 상세와 같은 커뮤니티 코스 스팟 조회를 사용한다. */
export function useCourseMapSpots(courseId: string, mountainId: string, serverId: number | undefined,
  routeMountainId: number | undefined, visible: boolean, filter: "all" | CourseSpot["kind"],
  route: readonly [number, number][] = EMPTY_ROUTE) {
  const request = useCourseCommunitySpots(mountainId, courseId, visible && serverId !== undefined, routeMountainId, route);
  const spots = request.state.status === "success" ? request.state.spots : EMPTY;
  const filtered = useMemo(() => filter === "all" ? spots : spots.filter(spot => spot.kind === filter), [filter, spots]);
  const failed = request.state.status === "error" ? [request] : [];
  const loading = request.state.status === "loading";

  return { spots: filtered, loading, failed };
}
