import { useMemo } from "react";
import { useCourseFacilities } from "./useCourseFacilities";
import { useCourseUserSpots } from "./useCourseUserSpots";
import type { CourseSpot } from "../types/courseDetail";

const EMPTY: readonly CourseSpot[] = [];

export function useCourseMapSpots(courseId: string, mountainId: string, serverId: number | undefined,
  routeMountainId: number | undefined, visible: boolean, filter: "all" | CourseSpot["kind"]) {
  const restrooms = useCourseFacilities(courseId, serverId, visible, "RESTROOM");
  const water = useCourseFacilities(courseId, serverId, visible, "DRINKING_WATER");
  const shelters = useCourseFacilities(courseId, serverId, visible, "SHELTER");
  const restroomSpots = restrooms.state.status === "success" ? restrooms.state.spots : EMPTY;
  const waterSpots = water.state.status === "success" ? water.state.spots : EMPTY;
  const shelterSpots = shelters.state.status === "success" ? shelters.state.spots : EMPTY;
  const users = useCourseUserSpots(mountainId, courseId, visible && serverId !== undefined, routeMountainId);
  const userSpots = users.state.status === "success" ? users.state.spots : EMPTY;
  const spots = useMemo(() => [...restroomSpots, ...waterSpots, ...shelterSpots, ...userSpots],
    [restroomSpots, waterSpots, shelterSpots, userSpots]);
  const filtered = useMemo(() => filter === "all" ? spots : spots.filter(spot => spot.kind === filter), [filter, spots]);
  const byKind = { restroom: restrooms, water, shelter: shelters };
  const official = filter === "all" ? Object.values(byKind) : filter === "photo" ? [] : [byKind[filter]];
  const requests = [...official, users];
  const failed = requests.filter(request => request.state.status === "error");
  const loading = requests.some(request => request.state.status === "loading");

  return { spots: filtered, loading, failed };
}
