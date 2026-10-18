import { useState } from "react";
import { findCourse } from "../../api/hikeMock";
import { courseFixtures } from "../../api/courseMock";
import { coursePaths } from "../../routes/courseRoutes";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/feedback";
import { ConfirmOverlay, HikeRouteMap, ScheduleSheet, SheetHandle } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { navigate, readHashParams } from "../../hooks/useHashRoute";
import { useToastMessage } from "../../hooks/useToastMessage";
import { deleteSchedule, useHikeSchedules } from "../../store/hikeScheduleStore";
import { formatDateTitle, formatDuration, formatKoreanTime, parseDateKey } from "../../utils/hikeFormat";
import { hikePaths, navigateTab } from "../hikeRoutes";
import "../hikePages.css";
import "./HikeDetailPage.css";

const MAP_PADDING = { top: 110, bottom: 50, left: 50, right: 50 };

/** HIKE-02 일정 상세 (`#hikes/detail?date=YYYY-MM-DD`). 진입: HIKE-01 일정 카드, HIKE-03 일정 보기 */
export function HikeDetailPage() {
  const [date] = useState(() => readHashParams().get("date") ?? "");
  const schedule = useHikeSchedules().find(item => item.date === date);
  const course = schedule ? findCourse(schedule.courseId) : undefined;
  const [overlay, setOverlay] = useState<"edit" | "cancel" | null>(null);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const toast = useToastMessage();
  const backToCalendar = () => navigate(hikePaths.calendar(date || undefined));

  return <div className="hike-page hike-map-page hike-detail-page">
    <main className="hike-page__body hike-map-page__body">
      {schedule && course ? <>
        <div className="hike-map-page__map">
          <HikeRouteMap route={course.route} padding={MAP_PADDING}
            label={`${course.mountainName} ${course.courseName} 코스 경로 지도`} />
          <div className="hike-map-page__top">
            <TopBar title="일정 상세" showAction={false} onBack={backToCalendar} />
          </div>
        </div>
        <section className="hike-map-sheet hike-detail-page__sheet" aria-labelledby="hike-detail-title">
          <SheetHandle collapsed={sheetCollapsed} onCollapsedChange={setSheetCollapsed} />
          <p className="hike-map-sheet__eyebrow">{formatDateTitle(parseDateKey(schedule.date))}</p>
          <h2 id="hike-detail-title" className="hike-map-sheet__title">{schedule.mountainName} · {schedule.courseName}</h2>
          <div className="hike-map-sheet__body" hidden={sheetCollapsed}>
            <dl className="hike-detail-page__info">
              <div><dt>출발</dt><dd>{formatKoreanTime(schedule.startTime)}</dd></div>
              <div><dt>거리</dt><dd>{schedule.distanceKm.toFixed(1)} km</dd></div>
              <div><dt>예상 시간</dt><dd>{formatDuration(course.durationMinutes)}</dd></div>
              <div><dt>최대 고도</dt><dd>{course.maxAltitudeM == null ? "—" : `${course.maxAltitudeM} m`}</dd></div>
              <div><dt>평균 경사도</dt><dd>{course.averageSlopePercent == null ? "—" : `약 ${course.averageSlopePercent}% (시안)`}</dd></div>
            </dl>
            <div className="hike-detail-page__actions">
              <Button variant="secondary" fullWidth label="코스 보기"
                onClick={() => {
                  const selected = courseFixtures.find(item => item.id === schedule.courseId);
                  if (selected) navigate(`${coursePaths.detail({ mountainId: selected.mountainId, courseId: selected.id })}?returnTo=${encodeURIComponent(hikePaths.detail(date))}`);
                }} />
              <Button variant="secondary" fullWidth label="일정 수정" onClick={() => setOverlay("edit")} />
            </div>
            <button type="button" className="hike-detail-page__cancel" onClick={() => setOverlay("cancel")}>일정 취소</button>
          </div>
        </section>
      </> : <div className="hike-page__empty-state">
        <TopBar title="일정 상세" showAction={false} onBack={backToCalendar} />
        <p>일정을 찾을 수 없어요. 삭제되었거나 날짜가 바뀌었을 수 있어요.</p>
        <Button label="내 등산 캘린더로" onClick={backToCalendar} />
      </div>}
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
      onConfirm={() => {
        deleteSchedule(schedule.date);
        navigate(hikePaths.calendar(schedule.date));
      }} />}
  </div>;
}
