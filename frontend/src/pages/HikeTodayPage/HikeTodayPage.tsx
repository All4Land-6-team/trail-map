import { useState } from "react";
import { findCourse, toDateKey } from "../../api/hikeMock";
import { hikeStartErrorMessage, startOrResumeHikeRecord } from "../../api/hikeRecordApi";
import { Button } from "../../components/common/Button";
import { Icon } from "../../components/common/Icon";
import { Toast } from "../../components/feedback";
import { HikeAlertConfirm, HikeRouteMap, LocationPermissionSheet, SheetHandle, SpotFilterChips, useDraggableSheet, type SpotFilter } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { MapAction } from "../../components/map";
import { navigate } from "../../hooks/useHashRoute";
import { useLocationPermission } from "../../hooks/useLocationPermission";
import { useToastMessage } from "../../hooks/useToastMessage";
import { useHikeSchedules } from "../../store/hikeScheduleStore";
import { courseFixtures } from "../../api/courseMock";
import { startHikeSession, useHikeSession } from "../../store/hikeSessionStore";
import { useRestoreActiveHike } from "../../store/hikeSessionRestore";
import { hikePaths, navigateTab } from "../hikeRoutes";
import "../hikePages.css";
import "./HikeTodayPage.css";

/** HIKE-03 오늘의 등산 (`#hikes/today`). 진입: FLOW-01 일정 알림 카드(진행 전) */
export function HikeTodayPage() {
  const [today] = useState(() => toDateKey(new Date()));
  const schedule = useHikeSchedules().find(item => item.date === today);
  const course = schedule ? findCourse(schedule.courseId) : undefined;
  const [filter, setFilter] = useState<SpotFilter>("all");
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const [recenterKey, setRecenterKey] = useState(0);
  const [askingAlerts, setAskingAlerts] = useState(false);
  const { sheetRef, bodyRef, collapsed: sheetCollapsed, sheetClassName, sheetStyle, handleProps: sheetHandleProps } = useDraggableSheet();
  const location = useLocationPermission();
  const toast = useToastMessage();
  const session = useHikeSession();
  // 새로고침 후에도 진행 중인 등산이 있으면 시작 버튼이 그 등산으로 이어지게 한다.
  useRestoreActiveHike();
  const [starting, setStarting] = useState(false);
  // 일정 API로 저장한 일정이면 등산 기록을 만든 뒤 넘어간다. 예시 일정은 화면 메모리로만 진행한다.
  const continueHike = async (alertsOn: boolean) => {
    if (!schedule || starting) return;
    const mountainId = courseFixtures.find(item => item.id === schedule.courseId)?.mountainId;
    if (!mountainId) return;
    setAskingAlerts(false);
    let record;
    if (schedule.scheduleId !== undefined) {
      setStarting(true);
      try {
        record = await startOrResumeHikeRecord(schedule.scheduleId);
      } catch (error) {
        toast.show(hikeStartErrorMessage(error));
        return;
      } finally {
        setStarting(false);
      }
    }
    startHikeSession(schedule, mountainId, alertsOn, record);
    navigate(hikePaths.active(alertsOn));
  };

  // 위치를 받은 경우에만 알림 수신 여부(HIKE-04)를 묻고 등산 중으로 넘어간다.
  const startHike = async () => {
    if (session && session.phase !== "complete") {
      navigate(session.phase === "downhill" ? hikePaths.downhill(session.alertsOn) : hikePaths.active(session.alertsOn));
      return;
    }
    const result = await location.check();
    if (result?.status === "granted") setAskingAlerts(true);
    else if (result?.status === "unavailable") toast.show("현재 위치를 받지 못했어요. 잠시 후 다시 시도해 주세요.");
  };

  return <div className="hike-page hike-map-page hike-today-page">
    <main className="hike-page__body hike-map-page__body">
      {schedule && course ? <>
        <div className="hike-map-page__map">
          <HikeRouteMap route={course.route} spots={course.spots} filter={filter} dimension={dimension}
            recenterKey={recenterKey} label={`${course.mountainName} ${course.courseName} 오늘 코스 지도`} />
          <div className="hike-map-page__top">
            <TopBar title="오늘의 등산" showAction={false} onBack={() => navigate("")} />
            <SpotFilterChips value={filter} onChange={setFilter} />
          </div>
          <div className="hike-map-page__tools">
            <MapAction iconName="3D" dimensionMode={dimension} onDimensionModeChange={setDimension}
              aria-label={dimension === "3D" ? "2D 지도로 전환" : "3D 지도로 전환"} />
            <MapAction aria-label="코스 전체 보기" onClick={() => setRecenterKey(key => key + 1)} />
          </div>
        </div>
        <section ref={sheetRef} className={`hike-map-sheet hike-today-page__sheet ${sheetClassName}`}
          style={sheetStyle} aria-labelledby="hike-today-title">
          <SheetHandle {...sheetHandleProps} />
          <p className="hike-map-sheet__eyebrow">오늘 {schedule.startTime} 출발</p>
          <h2 id="hike-today-title" className="hike-map-sheet__title">{schedule.mountainName} · {schedule.courseName}</h2>
          <div ref={bodyRef} className="hike-map-sheet__body" inert={sheetCollapsed}>
            <p className="hike-today-page__distance">{schedule.distanceKm.toFixed(1)} km</p>
            <div className="hike-today-page__sunset">
              <Icon name="Sun" size={24} />
              <span>일몰 {course.sunset}</span>
              <button type="button" className="hike-today-page__detail-link" onClick={() => navigate(hikePaths.detail(schedule.date))}>
                일정 보기 ›
              </button>
            </div>
            <Button fullWidth className="hike-today-page__start" label={location.checking ? "위치 확인 중" : starting ? "등산 시작 중" : "등산 시작하기"}
              disabled={location.checking || starting} trailingIcon={<Icon name="ArrowRight" size={20} color="currentColor" />}
              onClick={() => void startHike()} />
          </div>
        </section>
      </> : <div className="hike-page__empty-state">
        <TopBar title="오늘의 등산" showAction={false} onBack={() => navigate("")} />
        <p>오늘 등록된 등산 일정이 없어요.</p>
        <Button label="내 등산 캘린더로" onClick={() => navigate(hikePaths.calendar())} />
      </div>}
      {toast.message && <Toast className="hike-page__toast hike-today-page__toast" message={toast.message} />}
    </main>
    <BottomNavigation className="hike-page__nav" active="home" onNavigate={navigateTab} />

    {location.notice && <LocationPermissionSheet notice={location.notice} retrying={location.checking}
      onRetry={() => void startHike()} onDismiss={location.dismiss} />}
    {askingAlerts && <HikeAlertConfirm onAccept={() => void continueHike(true)}
      onDecline={() => void continueHike(false)} onDismiss={() => setAskingAlerts(false)} />}
  </div>;
}
