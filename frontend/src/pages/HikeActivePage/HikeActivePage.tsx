import { useMemo, useState } from "react";
import { findCourse } from "../../api/hikeMock";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/feedback";
import { hikeTargetIds, setHikeAlerts, useHikeSession } from "../../store/hikeSessionStore";
import { useRestoreActiveHike } from "../../store/hikeSessionRestore";
import { activeHikeFor } from "../../utils/activeHike";
import { HikeEndConfirm, HikeFloatingControls, HikeRouteMap, HikeShareSheet, HikeStatusHUD, HikeSunsetNotice, SpotFilterChips, SunArc, type SpotFilter } from "../../components/hike";
import { TopBar } from "../../components/layout";
import { MapAction } from "../../components/map";
import { navigate } from "../../hooks/useHashRoute";
import { useSunTimes } from "../../hooks/useSunTimes";
import { hikePaths } from "../hikeRoutes";
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
          padding={{ top: 150, bottom: 280, left: 40, right: 72 }}
          label={`${hike.courseName} 등산 경로 지도`} />
        <div className="hike-map-page__top">
          <TopBar title="등산 중" showAction={false} onBack={() => navigate(hikePaths.calendar())} />
          <SpotFilterChips value={filter} onChange={setFilter} />
        </div>
        <div className="hike-map-page__tools">
          <MapAction iconName="3D" dimensionMode={dimension} onDimensionModeChange={setDimension}
            aria-label={dimension === "3D" ? "2D 지도로 전환" : "3D 지도로 전환"} />
          <MapAction aria-label="현재 위치로 이동" onClick={() => setRecenterKey(key => key + 1)} />
          <MapAction variant="brand" aria-label="공유" onClick={() => setOverlay("share")} />
        </div>
        <div className="hike-active-page__bottom">
          <HikeStatusHUD stage={session.phase === "downhill" ? "descent" : "ascent"} courseName={hike.courseName}
            courseNotice={controls.courseNotice} paused={controls.paused}
            alertsOn={alertsOn} onAlertsChange={setHikeAlerts} onRequestEnd={() => setOverlay("end")} />
          <HikeSunsetNotice sun={sun} />
          <div className="hike-sun-controls">
            <SunArc sun={sun} variant="compact" />
            <HikeFloatingControls state={controls.paused ? "paused" : "recording"} busy={controls.busy} showMain={false}
              secondaryLabel={session.phase === "downhill" ? "등산 종료" : "하산 시작"}
              onMain={controls.togglePaused}
              onSecondary={() => session.phase === "downhill" ? setOverlay("end") : void controls.descend(alertsOn)} />
          </div>
        </div>
      </div>
    </main>
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
