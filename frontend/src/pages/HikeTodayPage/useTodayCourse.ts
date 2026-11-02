import { useEffect, useState } from "react";
import { findCourse } from "../../api/hikeMock";
import { requestCourseRoutes } from "../../api/courseRoutes";
import type { HikeCourse, HikeSchedule, LngLat } from "../../types/hike";
import { routeFromResponse } from "../../utils/activeHike";

export type TodayCourse = Pick<HikeCourse, "mountainName" | "courseName" | "route" | "spots" | "sunset"> & {
  /** 서버 코스 경로를 받는 중 */
  routeLoading?: boolean;
};

/**
 * 오늘의 등산 화면의 코스. 예시 데이터에 있는 코스는 예시 코스를 쓰고,
 * 없으면 일정의 서버 코스 번호로 코스 경로 API에서 경로를 받는다. 받기 전·실패 시 route는 비어 있다.
 */
export function useTodayCourse(schedule: HikeSchedule | undefined): TodayCourse | undefined {
  const fixture = schedule ? findCourse(schedule.courseId) : undefined;
  const serverCourseId = fixture ? undefined : schedule?.serverCourseId;
  const [loaded, setLoaded] = useState<{ courseId: number; route: LngLat[] }>();

  useEffect(() => {
    if (serverCourseId === undefined) return;
    const controller = new AbortController();
    requestCourseRoutes(`courses/${serverCourseId}/route`, controller.signal)
      .then(response => setLoaded({ courseId: serverCourseId, route: routeFromResponse(response) }))
      .catch(() => { if (!controller.signal.aborted) setLoaded({ courseId: serverCourseId, route: [] }); });
    return () => controller.abort();
  }, [serverCourseId]);

  if (fixture) return fixture;
  if (!schedule || serverCourseId === undefined) return undefined;
  const current = loaded?.courseId === serverCourseId ? loaded : undefined;
  return { mountainName: schedule.mountainName, courseName: schedule.courseName, sunset: "정보 없음", spots: [],
    route: current?.route ?? [], routeLoading: !current };
}
