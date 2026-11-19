import { useState } from "react";
import { courseFixtures } from "../../api/courseMock";
import { coursePaths } from "../../routes/courseRoutes";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/feedback";
import { ConfirmOverlay, HikeRouteMap, ScheduleSheet } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { navigate, readHashParams } from "../../hooks/useHashRoute";
import { useCourseMetrics } from "../../hooks/useCourseMetrics";
import { useScheduleCourse } from "../../hooks/useScheduleCourse";
import { useToastMessage } from "../../hooks/useToastMessage";
import { deleteSchedule, useHikeSchedules } from "../../store/hikeScheduleStore";
import { useHikeSession } from "../../store/hikeSessionStore";
import { useScheduleRecord } from "../../store/scheduleRecord";
import { formatDateTitle, formatDuration, formatKoreanTime, parseDateKey } from "../../utils/hikeFormat";
import { ALREADY_DELETED_SCHEDULE_MESSAGE, scheduleErrorMessage } from "../../utils/hikeSchedule";
import { hikePaths, navigateTab } from "../hikeRoutes";
import "../hikePages.css";
import "./HikeDetailPage.css";

// 출발·도착 이름표가 잘리지 않게 좌우 여백을 넉넉히 둔다 (기록 상세 REC-03과 같은 값).
const MAP_PADDING = { top: 32, bottom: 32, left: 48, right: 48 };
// 시안의 지도 이름표 문구 (지도 효과가 매번 다시 돌지 않게 상수로 둔다)
const ENDPOINT_NAMES = { start: "출발점", finish: "도착점" };

/** HIKE-02 일정 상세 (`#hikes/detail?date=YYYY-MM-DD`). 진입: HIKE-01 일정 카드, HIKE-03 일정 보기 */
export function HikeDetailPage() {
  const [date] = useState(() => readHashParams().get("date") ?? "");
  const schedule = useHikeSchedules().find(item => item.date === date);
  const course = useScheduleCourse(schedule);
  // 서버 코스는 DEM 분석의 최대 고도·급경사 비율, 예시 코스는 예시 값을 쓴다.
  const metrics = useCourseMetrics(course && !courseFixtures.some(item => item.id === schedule?.courseId) ? schedule?.serverCourseId : undefined);
  const maxAltitudeM = metrics?.maxElevationMeters ?? course?.maxAltitudeM ?? null;
  const steepPercent = metrics?.steepSectionRatioPercent ?? null;
  // 등산을 시작했거나 마친 일정은 바꾸거나 지우지 않는다 (기록과 일정의 코스·날짜가 어긋나지 않게).
  const record = useScheduleRecord(schedule);
  const session = useHikeSession();
  const [overlay, setOverlay] = useState<"edit" | "cancel" | null>(null);
  const toast = useToastMessage();
  const backToCalendar = () => navigate(hikePaths.calendar(date || undefined));

  const title = schedule ? `${schedule.mountainName} · ${schedule.courseName}` : "";

  return <div className="hike-page hike-detail-page">
    <TopBar title="일정 상세" showAction={false} onBack={backToCalendar} />
    <main className="hike-page__body hike-detail-page__body">
      {schedule && course ? <>
        <h2 className="hike-detail-page__title">{title}</h2>
        <dl className="hike-detail-page__when">
          <div><dt>날짜</dt><dd>{formatDateTitle(parseDateKey(schedule.date))}</dd></div>
          <div><dt>출발</dt><dd>{formatKoreanTime(schedule.startTime)}</dd></div>
        </dl>

        <section className="hike-detail-page__section" aria-labelledby="hike-detail-map-title">
          <h3 id="hike-detail-map-title">코스 지도</h3>
          <div className="hike-detail-page__map">
            {course.route.length > 1
              // 기록 상세(REC-03)처럼 위에서 내려다본 요약 지도에 출발·도착을 표시하고 손으로 움직이지 않게 고정한다.
              ? <HikeRouteMap route={course.route} mountainName={course.mountainName} dimension="2D" endpointLabels={ENDPOINT_NAMES}
                interactive={false} padding={MAP_PADDING} label={`${title} 코스 경로 지도`} />
              : <p className="hike-detail-page__map-status" role="status">
                {course.routeLoading ? "코스 경로를 불러오는 중이에요." : "코스 경로를 불러오지 못했어요."}</p>}
          </div>
        </section>

        <section className="hike-detail-page__section" aria-labelledby="hike-detail-info-title">
          <h3 id="hike-detail-info-title">코스 정보</h3>
          <dl className="hike-detail-page__info">
            <div><dt>거리</dt><dd>{schedule.distanceKm.toFixed(1)} km</dd></div>
            <div><dt>예상 시간</dt><dd>{course.durationMinutes == null ? "—" : formatDuration(course.durationMinutes)}</dd></div>
            <div><dt>최대 고도</dt><dd>{maxAltitudeM == null ? "—" : `${Math.round(maxAltitudeM)} m`}</dd></div>
            <div><dt>급경사 비율</dt><dd>{steepPercent == null ? "—" : `${Math.round(steepPercent)}%`}</dd></div>
          </dl>
        </section>

        <div className="hike-detail-page__actions">
          <Button variant="secondary" fullWidth label="코스 보기"
            onClick={() => {
              // 예시 코스는 예시 산·코스 ID, 서버 코스는 코스 경로 API의 산 키와 `db-{번호}`로 코스 화면을 연다.
              const fixture = courseFixtures.find(item => item.id === schedule.courseId);
              const link = fixture ? { mountainId: fixture.mountainId, courseId: fixture.id } : course.courseLink;
              if (link) navigate(`${coursePaths.detail(link)}?returnTo=${encodeURIComponent(hikePaths.detail(date))}`);
            }} />
          {record?.status === "COMPLETED"
            ? <Button fullWidth label="등산 기록 보기" onClick={() => navigate(hikePaths.record(schedule.date))} />
            : record
              // 진행 중·하산 중: 마지막 진행 상태 화면으로 돌아간다.
              ? <Button fullWidth label={record.status === "DESCENDING" ? "하산중 화면 보기" : "등산중 화면 보기"}
                onClick={() => navigate(record.status === "DESCENDING" ? hikePaths.downhill(session?.alertsOn ?? false)
                  : hikePaths.active(session?.alertsOn ?? false))} />
              : <Button fullWidth label="일정 수정" onClick={() => setOverlay("edit")} />}
        </div>
        {record ? <p className="hike-detail-page__locked">{record.status === "COMPLETED"
          ? "등산을 마친 일정은 바꾸거나 취소할 수 없어요." : "진행 중인 등산이 있는 일정은 바꾸거나 취소할 수 없어요."}</p>
          : <button type="button" className="hike-detail-page__cancel" onClick={() => setOverlay("cancel")}>일정 취소</button>}
      </> : <p className="hike-detail-page__empty">일정을 찾을 수 없어요. 삭제되었거나 날짜가 바뀌었을 수 있어요.</p>}
      {toast.message && <Toast className="hike-page__toast hike-detail-page__toast" message={toast.message} />}
    </main>
    <BottomNavigation className="hike-page__nav" active="myHikes" onNavigate={navigateTab} />

    {overlay === "edit" && schedule && <ScheduleSheet variant="edit" course={schedule} schedule={schedule}
      onClose={() => setOverlay(null)}
      onSaved={saved => {
        setOverlay(null);
        // 날짜를 바꿨으면 바뀐 날짜의 상세로 주소를 옮긴다.
        if (saved.date !== date) navigate(hikePaths.detail(saved.date));
        else toast.show("일정을 수정했어요");
      }} />}
    {overlay === "cancel" && schedule && <ConfirmOverlay title="일정을 취소할까요?"
      body={`${schedule.mountainName} · ${schedule.courseName} 일정이 삭제돼요.`}
      cancelLabel="닫기" confirmLabel="일정 취소" onCancel={() => setOverlay(null)}
      onConfirm={async () => {
        try {
          const result = await deleteSchedule(schedule);
          setOverlay(null);
          if (result === "alreadyDeleted") {
            toast.show(ALREADY_DELETED_SCHEDULE_MESSAGE);
            return;
          }
          navigate(hikePaths.calendar(schedule.date));
        } catch (error) {
          setOverlay(null);
          toast.show(scheduleErrorMessage(error, "취소"));
        }
      }} />}
  </div>;
}
