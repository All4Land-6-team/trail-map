import { useState } from "react";
import { sampleCourses, scheduleFor } from "../../api/hikeMock";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/feedback";
import { HikeEndConfirm, LocationPermissionSheet, ScheduleSheet } from "../../components/hike";
import { navigate } from "../../hooks/useHashRoute";
import { useLocationPermission } from "../../hooks/useLocationPermission";
import { useToastMessage } from "../../hooks/useToastMessage";
import { useHikeSchedules } from "../../store/hikeScheduleStore";
import { hikePaths } from "../hikeRoutes";
import "./HikeStatusPreviewPage.css";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const course = scheduleFor(sampleCourses[0], "", "");

const hikeScreens = [
  { label: "HIKE-01 내 등산 캘린더", path: hikePaths.calendar() },
  { label: "HIKE-03 오늘의 등산 (→ HIKE-04)", path: hikePaths.today },
  { label: "HIKE-05 등산 중 (→ HIKE-06)", path: hikePaths.active(true) },
  { label: "HIKE-07 하산 중", path: hikePaths.downhill(true) },
  { label: "HIKE-08 등산 완료", path: hikePaths.complete },
];

/**
 * FLOW-06 일정 시트와 상태 화면 확인용 개발 페이지 (`?preview=hike-status`, 개발 서버 전용).
 * FLOW-02·04 코스 화면이 생기면 ScheduleSheet를 그 화면의 "일정 등록 →" 버튼에 연결한다.
 */
export function HikeStatusPreviewPage() {
  const location = useLocationPermission();
  const schedules = useHikeSchedules();
  const [dialog, setDialog] = useState<"schedule" | "end" | null>(null);
  const toast = useToastMessage();
  // FLOW-06 닫힘 상태: 이 코스에 일정이 있으면 버튼이 "일정 변경 →"으로 바뀐다.
  const courseSchedule = schedules.find(item => item.courseId === course.courseId);

  const startHike = async () => {
    const result = await location.check();
    if (result?.status === "granted") toast.show("위치 확인 완료 → HIKE-04 알림 수신 확인");
    else if (result?.status === "unavailable") toast.show("현재 위치를 받지 못했어요 (GPS 수신 문제는 범위 밖)");
  };

  // ?preview 값을 지우고 해시만 바꿔, 새로고침 없이(메모리 일정 유지) 실제 화면으로 이동한다.
  const openApp = (path: string) => {
    window.history.pushState(null, "", window.location.pathname);
    navigate(path);
  };

  return <main className="hike-status-preview">
    <h1 className="hike-status-preview__title">내 등산 화면 미리보기</h1>

    <section className="hike-status-preview__group" aria-labelledby="preview-flow06">
      <h2 id="preview-flow06" className="hike-status-preview__subtitle">FLOW-06 일정 등록/수정/삭제</h2>
      <p className="hike-status-preview__note">
        {courseSchedule
          ? `북한산 · 백운대 코스 일정: ${courseSchedule.date} ${courseSchedule.startTime}`
          : "북한산 · 백운대 코스에 등록된 일정이 없어요."}
      </p>
      <Button fullWidth label={courseSchedule ? "일정 변경 →" : "일정 등록 →"} onClick={() => setDialog("schedule")} />
    </section>

    <section className="hike-status-preview__group" aria-labelledby="preview-status">
      <h2 id="preview-status" className="hike-status-preview__subtitle">상태 화면</h2>
      <Button fullWidth variant="secondary" label={location.checking ? "위치 확인 중" : "위치 권한 확인 (HIKE-04)"}
        disabled={location.checking} onClick={() => void startHike()} />
      <Button fullWidth variant="secondary" label="등산 종료 확인 (HIKE-05)" onClick={() => setDialog("end")} />
    </section>

    <section className="hike-status-preview__group" aria-labelledby="preview-screens">
      <h2 id="preview-screens" className="hike-status-preview__subtitle">화면 바로 가기</h2>
      {hikeScreens.map(screen => <Button key={screen.path} fullWidth variant="secondary" label={screen.label}
        onClick={() => openApp(screen.path)} />)}
    </section>
    {toast.message && <Toast message={toast.message} />}

    {dialog === "schedule" && <ScheduleSheet course={course} schedule={courseSchedule}
      onClose={() => setDialog(null)}
      onSaved={(saved, result) => {
        // 같은 날짜 일정을 대체하면 HIKE-01 캘린더로 이동한다.
        if (result.replaced) openApp(hikePaths.calendar(saved.date));
      }}
      onDeleted={() => {
        setDialog(null);
        toast.show("일정을 삭제했어요");
      }} />}
    {location.notice && <LocationPermissionSheet notice={location.notice} retrying={location.checking}
      onRetry={() => void startHike()} onDismiss={location.dismiss} />}
    {dialog === "end" && <HikeEndConfirm onCancel={() => setDialog(null)} onConfirm={async () => {
      await wait(600);
      setDialog(null);
      toast.show("기록 저장 → HIKE-08 등산 완료로 이동");
    }} />}
  </main>;
}
