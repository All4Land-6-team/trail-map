import { useState } from "react";
import { findCourse, toDateKey } from "../../api/hikeMock";
import { Button } from "../../components/common/Button";
import { Icon } from "../../components/common/Icon";
import { Toast } from "../../components/feedback";
import { HikeAlertConfirm, HikeRouteMap, LocationPermissionSheet, SpotFilterChips, type SpotFilter } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { MapAction } from "../../components/map";
import { navigate } from "../../hooks/useHashRoute";
import { useLocationPermission } from "../../hooks/useLocationPermission";
import { useToastMessage } from "../../hooks/useToastMessage";
import { useHikeSchedules } from "../../store/hikeScheduleStore";
import { courseFixtures } from "../../api/courseMock";
import { startHikeSession, useHikeSession } from "../../store/hikeSessionStore";
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
  const location = useLocationPermission();
  const toast = useToastMessage();
  const session = useHikeSession();
  const continueHike = (alertsOn: boolean) => {
    if (!schedule) return;
    const mountainId = courseFixtures.find(item => item.id === schedule.courseId)?.mountainId;
    if (!mountainId) return;
    startHikeSession(schedule, mountainId, alertsOn);
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
        <section className="hike-map-sheet hike-today-page__sheet" aria-labelledby="hike-today-title">
          <p className="hike-map-sheet__eyebrow">오늘 {schedule.startTime} 출발</p>
          <h2 id="hike-today-title" className="hike-map-sheet__title">{schedule.mountainName} · {schedule.courseName}</h2>
          <p className="hike-today-page__distance">{schedule.distanceKm.toFixed(1)} km</p>
          <div className="hike-today-page__sunset">
            <Icon name="Sun" size={24} />
            <span>일몰 {course.sunset}</span>
            <button type="button" className="hike-today-page__detail-link" onClick={() => navigate(hikePaths.detail(schedule.date))}>
              일정 보기 ›
            </button>
          </div>
          <Button fullWidth className="hike-today-page__start" label={location.checking ? "위치 확인 중" : "등산 시작하기"}
            disabled={location.checking} trailingIcon={<Icon name="ArrowRight" size={20} color="currentColor" />}
            onClick={() => void startHike()} />
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
    {askingAlerts && <HikeAlertConfirm onAccept={() => continueHike(true)}
      onDecline={() => continueHike(false)} onDismiss={() => setAskingAlerts(false)} />}
  </div>;
}
