import { useMemo, useState } from "react";
import { findCourse } from "../../api/hikeMock";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/feedback";
import { hikeTargetIds, setHikeAlerts, useHikeSession } from "../../store/hikeSessionStore";
import { useRestoreActiveHike } from "../../store/hikeSessionRestore";
import { activeHikeFor } from "../../utils/activeHike";
import { HikeEndConfirm, HikeProgressPanel, HikeRouteMap, HikeShareSheet, HikeSunsetNotice, SpotFilterChips, SunArc, type SpotFilter } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { MapAction, MapCompassAction } from "../../components/map";
import { navigate } from "../../hooks/useHashRoute";
import { useSunTimes } from "../../hooks/useSunTimes";
import { hikePaths, navigateTab } from "../hikeRoutes";
import { useHikeControls } from "./useHikeControls";
import "../hikePages.css";
import "./HikeActivePage.css";

/** HIKE-05 등산 중 (`#hikes/active?alerts=on|off`). 알림 기본값은 HIKE-04 알림 수신 확인에서 고른 값이다. */
export function HikeActivePage() {
  const session = useHikeSession();
  const restoring = useRestoreActiveHike();
  const course = session ? findCourse(session.schedule.courseId) : undefined;
  const hike = useMemo(() => activeHikeFor(course, session?.schedule, session?.coursePath, session?.phase === "downhill"),
    [course, session?.schedule, session?.coursePath, session?.phase]);
  const [filter, setFilter] = useState<SpotFilter>("all");
  // 등산을 시작하면 3D 내비 모드(현재 위치를 따라가며 진행 방향을 위로)로 보여 준다. 2D는 경로 전체 보기다.
  const [dimension, setDimension] = useState<"2D" | "3D">("3D");
  const [recenterKey, setRecenterKey] = useState(0);
  const alertsOn = session?.alertsOn ?? false;
  const [overlay, setOverlay] = useState<"share" | "end" | null>(null);
  const controls = useHikeControls(session, hike);
  const routeCenter = controls.route[Math.floor(controls.route.length / 2)];
  const sun = useSunTimes(session?.currentPosition ?? routeCenter);
  const finish = () => controls.finish();
  if (!session && restoring) return <main className="hike-page__empty-state"><p>진행 중인 등산을 불러오는 중이에요.</p></main>;
  if (!session || !hike || session.phase === "complete") return <main className="hike-page__empty-state">
    <p>진행 중인 등산이 없어요.</p><Button label="오늘의 등산 보기" onClick={() => navigate(hikePaths.today)} /></main>;

  return <div className="hike-page hike-map-page hike-active-page">
    <main className="hike-page__body hike-map-page__body">
      <div className="hike-map-page__map">
        <HikeRouteMap route={controls.route} peak={controls.peak} mountainName={hike.mountainName} traveledKm={controls.traveledKm ?? hike.traveledKm}
          {...controls.tracking ? { position: session.currentPosition, traveledPath: controls.mapPath } : { currentIndex: hike.currentIndex }}
          progressMeters={controls.progressMeters} stage={session.phase === "downhill" ? "descent" : "ascent"}
          spots={hike.spots} filter={filter} dimension={dimension} recenterKey={recenterKey} navigation
          padding={{ top: 150, bottom: 320, left: 40, right: 72 }}
          label={`${hike.courseName} 등산 경로 지도`} />
        <div className="hike-map-page__top">
          <TopBar title={session.phase === "downhill" ? "하산 중" : "등산 중"} subtitle={hike.courseName} showAction={false}
            onBack={() => navigate(hikePaths.calendar())} />
          <SpotFilterChips value={filter} onChange={setFilter} />
          {/* 일몰 알림은 지도 한가운데를 가리지 않게 필터 바로 아래에 둔다 */}
          <HikeSunsetNotice sun={sun} />
        </div>
        <div className="hike-map-page__tools">
          <MapAction iconName="3D" dimensionMode={dimension} onDimensionModeChange={setDimension}
            aria-label={dimension === "3D" ? "2D 지도로 전환" : "3D 지도로 전환"} />
          <MapAction aria-label="현재 위치로 이동" onClick={() => setRecenterKey(key => key + 1)} />
          <MapAction iconName={alertsOn ? "Bell" : "BellOff"} aria-pressed={alertsOn}
            aria-label={alertsOn ? "일몰 알림 끄기" : "일몰 알림 켜기"} onClick={() => setHikeAlerts(!alertsOn)} />
          <MapAction variant="brand" aria-label="공유" onClick={() => setOverlay("share")} />
          <MapCompassAction />
        </div>
        {/* 진행 시트를 접으면 일출·일몰도 시트를 따라 내려간다 (--hike-sheet-inset) */}
        <div className="hike-active-page__sun">
          <SunArc sun={sun} variant="compact" />
        </div>
      </div>
      {/* 올라가는 중에는 하산 시작(왼쪽) 옆에 등산 종료(오른쪽)를 둔다. 하산 중에는 등산 종료 하나만 둔다. */}
      <HikeProgressPanel stage={session.phase === "downhill" ? "descent" : "ascent"}
        traveledKm={controls.traveledKm ?? hike.traveledKm} remainingKm={controls.remainingKm}
        progressPercent={controls.progressPercent} courseNotice={controls.courseNotice} busy={controls.busy}
        onStartDescent={session.phase === "downhill" ? undefined : () => void controls.descend(alertsOn)}
        onEnd={() => setOverlay("end")} />
    </main>
    <BottomNavigation className="hike-page__nav" active="home" onNavigate={navigateTab} />
    {controls.message && <Toast className="hike-page__toast" message={controls.message} />}

    {overlay === "share" && <HikeShareSheet onClose={() => setOverlay(null)} onShareSpot={() => {
      setOverlay(null);
      const target = hikeTargetIds(session);
      const query = new URLSearchParams({ screen: "spotPicker", mode: "active", course: target.courseId,
        returnTo: session.phase === "downhill" ? hikePaths.downhill(alertsOn) : hikePaths.active(alertsOn) });
      if (target.mountainId) query.set("mountain", target.mountainId);
      navigate(`community?${query}`);
    }} />}
    {overlay === "end" && <HikeEndConfirm onCancel={() => setOverlay(null)} onConfirm={finish} />}
  </div>;
}
