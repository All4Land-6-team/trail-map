import { courseFixtures } from "../../api/courseMock";
import { mountains } from "../../api/homeMock";
import { ScheduleSheet } from "../../components/hike";
import { navigate } from "../../hooks/useHashRoute";
import { readCourseRoute, coursePaths } from "../../routes/courseRoutes";
import { courseDetailNavigationSource, readCourseDetailView } from "../../routes/courseDetailRoutes";
import { internalReturnPath, spotReviewPath } from "../../routes/communityRoutes";
import { useHikeSchedules } from "../../store/hikeScheduleStore";
import type { CourseRequest } from "../../types/course";
import { CourseListPage } from "../CourseListPage/CourseListPage";
import { CourseDetailPage } from "./CourseDetailPage";
import { hikePaths } from "../hikeRoutes";

export function CourseFlow({ route }: { route: string }) {
  const request = readCourseRoute(route)!;
  const schedules = useHikeSchedules();
  const query = new URLSearchParams(route.split("?")[1]);
  const isSchedule = request.destination === "schedule";
  const returnTo = internalReturnPath(query.get("returnTo"), request.courseId
    ? coursePaths.detail({ mountainId: request.mountainId, courseId: request.courseId }) : coursePaths.list(request.mountainId));
  const background = isSchedule ? returnTo : route;
  const viewRequest = readCourseRoute(background) ?? request;
  const course = courseFixtures.find(item => item.id === request.courseId && item.mountainId === request.mountainId);
  const schedule = schedules.find(item => item.courseId === request.courseId);
  const openSchedule = (selected: CourseRequest) => navigate(`${coursePaths.schedule(selected)}?returnTo=${encodeURIComponent(route)}`);
  return <>
    {viewRequest.courseId ? <CourseDetailPage key={`${viewRequest.mountainId}/${viewRequest.courseId}`}
      mountainId={viewRequest.mountainId} courseId={viewRequest.courseId} view={readCourseDetailView(background)}
      hasSchedule={!!schedule} onScheduleOpen={openSchedule} onSpotOpen={spot => navigate(spotReviewPath(spot))}
      activeDestination={courseDetailNavigationSource(returnTo)}
      onBack={query.get("returnTo") && !isSchedule ? () => navigate(returnTo) : undefined} />
      : <CourseListPage key={viewRequest.mountainId} mountainId={viewRequest.mountainId}
        initialCourseId={isSchedule ? request.courseId : viewRequest.selectedCourseId} onScheduleOpen={openSchedule} />}
    {isSchedule && course && <ScheduleSheet key={course.id} course={{ courseId: course.id, courseName: course.name,
      mountainName: mountains.find(item => item.id === course.mountainId)?.name ?? "산", distanceKm: course.distanceKm }}
      schedule={schedule} onClose={() => navigate(returnTo)}
      onSaved={saved => navigate(hikePaths.calendar(saved.date))} onDeleted={() => navigate(returnTo)} />}
  </>;
}
