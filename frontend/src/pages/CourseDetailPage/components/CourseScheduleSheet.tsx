import { mountains } from "../../../api/homeMock";
import { Button } from "../../../components/common/Button";
import { ScheduleSheet } from "../../../components/hike";
import { OverlayLayer } from "../../../components/hike/OverlayLayer";
import { BottomSheet } from "../../../components/overlay";
import { navigate } from "../../../hooks/useHashRoute";
import { useHikeScheduleMode, useHikeSchedules } from "../../../store/hikeScheduleStore";
import type { CourseRequest } from "../../../types/course";
import { canScheduleCourse } from "../../../utils/courseIdentity";
import { hikePaths } from "../../hikeRoutes";
import { useCourseDetail } from "../hooks/useCourseDetail";

/** 직접 일정 주소에 진입해도 현재 산·DB 코스 ID를 검증한 경로 정보를 등록창에 전달한다. */
export function CourseScheduleSheet({ request, returnTo }: { request: CourseRequest; returnTo: string }) {
  const { state, retry } = useCourseDetail(request);
  const schedules = useHikeSchedules();
  const mode = useHikeScheduleMode();
  const close = () => navigate(returnTo);
  const course = state.status === "success" ? state.data.course : null;
  const loading = state.status === "loading" || mode === "checking";

  if (!loading && course && canScheduleCourse(course)) return <ScheduleSheet key={course.id}
    course={{ courseId: course.id, courseName: course.name, distanceKm: course.distanceKm,
      mountainName: mountains.find(item => item.id === course.mountainId)?.name ?? "산" }}
    schedule={schedules.find(item => item.courseId === course.id)} onClose={close}
    onSaved={saved => navigate(hikePaths.calendar(saved.date))} onDeleted={close} />;

  return <OverlayLayer placement="bottom" aboveNav onDismiss={close}>
    <BottomSheet role="dialog" aria-modal="true" title="등산 일정 등록" showDescription={false} showFooter onClose={close}
      content={<p role={loading ? "status" : "alert"}>{loading ? "코스와 일정 정보를 불러오는 중이에요."
        : state.status === "error" ? "코스 정보를 불러오지 못했어요. 다시 시도해 주세요."
          : "일정으로 등록할 코스 정보를 찾을 수 없어요."}</p>}
      footer={<Button fullWidth onClick={state.status === "error" && !loading ? retry : close}>
        {state.status === "error" && !loading ? "다시 불러오기" : "닫기"}
      </Button>} />
  </OverlayLayer>;
}
