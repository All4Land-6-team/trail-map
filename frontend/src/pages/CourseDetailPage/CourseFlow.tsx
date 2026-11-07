import { navigate } from "../../hooks/useHashRoute";
import { readCourseRoute, coursePaths } from "../../routes/courseRoutes";
import { courseDetailNavigationSource, readCourseDetailView } from "../../routes/courseDetailRoutes";
import { courseReviewPath, internalReturnPath, spotReviewPath } from "../../routes/communityRoutes";
import { useHikeSchedules } from "../../store/hikeScheduleStore";
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
  const schedule = schedules.find(item => item.courseId === request.courseId);
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
