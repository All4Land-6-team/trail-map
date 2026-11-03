import { useEffect, useState } from "react";
import { findCourse } from "../api/hikeMock";
import { requestCourseRoutes } from "../api/courseRoutes";
import { loadCourseFacilities } from "../api/courseFacilities";
import type { CourseFacilityType } from "../types/facility";
import type { HikeCourse, HikeSchedule, HikeSpot, LngLat } from "../types/hike";
import { routeFromResponse } from "../utils/activeHike";

export type ScheduleCourse = Pick<HikeCourse, "mountainName" | "courseName" | "route" | "spots" | "sunset"
  | "maxAltitudeM" | "averageSlopePercent"> & {
  /** 예상 소요 시간(분). 서버 코스에 정보가 없으면 null */
  durationMinutes: number | null;
  /** 코스 화면 주소에 쓰는 산 키(bukhansan 등)와 코스 ID. 예시 코스는 예시 ID, 서버 코스는 `db-{번호}` */
  courseLink?: { mountainId: string; courseId: string };
  /** 서버 코스 경로를 받는 중 */
  routeLoading?: boolean;
};

type LoadedRoute = { courseId: number; route: LngLat[]; mountainKey?: string; durationMinutes: number | null };
const NO_SPOTS: HikeSpot[] = [];
type LoadedSpots = { courseId: number; spots: HikeSpot[] };

const FACILITY_SPOT_KINDS: ReadonlyArray<[CourseFacilityType, HikeSpot["kind"], string]> = [
  ["RESTROOM", "restroom", "화장실"], ["DRINKING_WATER", "water", "음수대"], ["SHELTER", "shelter", "쉼터"],
];

/** 코스 주변 공식 시설(화장실·음수대·쉼터)을 지도 스팟으로 받는다. 종류별로 실패해도 나머지는 표시한다. */
async function loadFacilitySpots(courseId: number, signal: AbortSignal): Promise<HikeSpot[]> {
  const results = await Promise.allSettled(FACILITY_SPOT_KINDS.map(([type, kind, label]) =>
    loadCourseFacilities(courseId, { signal, type }).then(facilities => facilities.map((facility): HikeSpot => ({
      id: `${kind}-${facility.facilityId}`, kind, name: facility.name ?? label,
      position: [facility.longitude, facility.latitude],
    })))));
  return results.flatMap(result => result.status === "fulfilled" ? result.value : []);
}

function parseRoute(courseId: number, response: unknown): LoadedRoute {
  const data = (response as { data?: { mountainKey?: unknown; durationSeconds?: unknown } } | null)?.data;
  return {
    courseId,
    route: routeFromResponse(response),
    mountainKey: typeof data?.mountainKey === "string" ? data.mountainKey : undefined,
    durationMinutes: typeof data?.durationSeconds === "number" ? Math.round(data.durationSeconds / 60) : null,
  };
}

/**
 * 일정의 코스 (오늘의 등산 · 일정 상세). 예시 데이터에 있는 코스는 예시 코스를 쓰고,
 * 없으면 일정의 서버 코스 번호로 코스 경로 API에서 경로를, 시설 API에서 주변 시설을 받는다. 받기 전·실패 시 route는 비어 있다.
 */
export function useScheduleCourse(schedule: HikeSchedule | undefined): ScheduleCourse | undefined {
  const fixture = schedule ? findCourse(schedule.courseId) : undefined;
  const serverCourseId = fixture ? undefined : schedule?.serverCourseId;
  const [loaded, setLoaded] = useState<LoadedRoute>();
  const [loadedSpots, setLoadedSpots] = useState<LoadedSpots>();

  useEffect(() => {
    if (serverCourseId === undefined) return;
    const controller = new AbortController();
    requestCourseRoutes(`courses/${serverCourseId}/route`, controller.signal)
      .then(response => setLoaded(parseRoute(serverCourseId, response)))
      .catch(() => { if (!controller.signal.aborted) setLoaded({ courseId: serverCourseId, route: [], durationMinutes: null }); });
    loadFacilitySpots(serverCourseId, controller.signal)
      .then(spots => { if (!controller.signal.aborted) setLoadedSpots({ courseId: serverCourseId, spots }); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [serverCourseId]);

  if (fixture) return fixture;
  if (!schedule || serverCourseId === undefined) return undefined;
  const current = loaded?.courseId === serverCourseId ? loaded : undefined;
  return { mountainName: schedule.mountainName, courseName: schedule.courseName, sunset: "정보 없음",
    spots: loadedSpots?.courseId === serverCourseId ? loadedSpots.spots : NO_SPOTS,
    maxAltitudeM: null, averageSlopePercent: null, durationMinutes: current?.durationMinutes ?? null,
    route: current?.route ?? [], routeLoading: !current,
    courseLink: current?.mountainKey ? { mountainId: current.mountainKey, courseId: `db-${serverCourseId}` } : undefined };
}
