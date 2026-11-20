import { navigate } from "../../hooks/useHashRoute";
import { readCourseRoute, coursePaths } from "../../routes/courseRoutes";
import { courseDetailNavigationSource, readCourseDetailView } from "../../routes/courseDetailRoutes";
import { courseReviewPath, internalReturnPath, spotReviewPath } from "../../routes/communityRoutes";
import { useHikeSchedules } from "../../store/hikeScheduleStore";
import { useEditableCourseSchedule } from "../../store/scheduleRecord";
import type { CourseRequest } from "../../types/course";
import { CourseListPage } from "../CourseListPage/CourseListPage";
import { CourseDetailPage } from "./CourseDetailPage";
import { CourseScheduleSheet } from "./components/CourseScheduleSheet";

export function CourseFlow({ route }: { route: string }) {
  const request = readCourseRoute(route)!;
  const schedules = useHikeSchedules();
  const query = new URLSearchParams(route.split("?")[1]);
  const isSchedule = request.destination === "schedule";
  const returnTo = internalReturnPath(query.get("returnTo"), request.courseId
    ? coursePaths.detail({ mountainId: request.mountainId, courseId: request.courseId }) : coursePaths.list(request.mountainId));
  const background = isSchedule ? returnTo : route;
  const viewRequest = readCourseRoute(background) ?? request;
  // 등산을 시작했거나 마친 일정은 「일정 수정」 대상이 아니다 (새 일정 등록으로 연다).
  const schedule = useEditableCourseSchedule(schedules, request.courseId);
  const openSchedule = (selected: CourseRequest) => navigate(`${coursePaths.schedule(selected)}?returnTo=${encodeURIComponent(route)}`);
  return <>
    {viewRequest.courseId ? <CourseDetailPage key={`${viewRequest.mountainId}/${viewRequest.courseId}`}
      mountainId={viewRequest.mountainId} courseId={viewRequest.courseId} view={readCourseDetailView(background)}
      hasSchedule={!!schedule} onScheduleOpen={openSchedule} onSpotOpen={spot => navigate(spotReviewPath(spot))}
      activeDestination={courseDetailNavigationSource(returnTo)}
      onReviewsOpen={selected => navigate(courseReviewPath({ ...selected, returnPath: route }))}
      onBack={query.get("returnTo") && !isSchedule ? () => navigate(returnTo) : undefined} />
      : <CourseListPage key={viewRequest.mountainId} mountainId={viewRequest.mountainId}
        initialCourseId={isSchedule ? request.courseId : viewRequest.selectedCourseId} onScheduleOpen={openSchedule} />}
    {isSchedule && request.courseId && <CourseScheduleSheet key={`${request.mountainId}/${request.courseId}`}
      request={{ mountainId: request.mountainId, courseId: request.courseId }} returnTo={returnTo} />}
  </>;
}
