import { useEffect, useState } from "react";
import { findCourse } from "../api/hikeMock";
import { requestCourseRoutes } from "../api/courseRoutes";
import type { HikeCourse, HikeSchedule, LngLat } from "../types/hike";
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
 * 없으면 일정의 서버 코스 번호로 코스 경로 API에서 경로를 받는다. 받기 전·실패 시 route는 비어 있다.
 */
export function useScheduleCourse(schedule: HikeSchedule | undefined): ScheduleCourse | undefined {
  const fixture = schedule ? findCourse(schedule.courseId) : undefined;
  const serverCourseId = fixture ? undefined : schedule?.serverCourseId;
  const [loaded, setLoaded] = useState<LoadedRoute>();

  useEffect(() => {
    if (serverCourseId === undefined) return;
    const controller = new AbortController();
    requestCourseRoutes(`courses/${serverCourseId}/route`, controller.signal)
      .then(response => setLoaded(parseRoute(serverCourseId, response)))
      .catch(() => { if (!controller.signal.aborted) setLoaded({ courseId: serverCourseId, route: [], durationMinutes: null }); });
    return () => controller.abort();
  }, [serverCourseId]);

  if (fixture) return fixture;
  if (!schedule || serverCourseId === undefined) return undefined;
  const current = loaded?.courseId === serverCourseId ? loaded : undefined;
  return { mountainName: schedule.mountainName, courseName: schedule.courseName, sunset: "정보 없음", spots: [],
    maxAltitudeM: null, averageSlopePercent: null, durationMinutes: current?.durationMinutes ?? null,
    route: current?.route ?? [], routeLoading: !current,
    courseLink: current?.mountainKey ? { mountainId: current.mountainKey, courseId: `db-${serverCourseId}` } : undefined };
}
