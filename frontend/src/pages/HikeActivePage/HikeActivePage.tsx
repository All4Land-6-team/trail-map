import { useMemo, useState } from "react";
import { findCourse } from "../../api/hikeMock";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/feedback";
import { setHikeAlerts, useHikeSession } from "../../store/hikeSessionStore";
import { useRestoreActiveHike } from "../../store/hikeSessionRestore";
import { initialHikeProgress } from "../../utils/activeHike";
import { HikeEndConfirm, HikeRouteMap, HikeShareSheet, SpotFilterChips, type SpotFilter } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { MapAction } from "../../components/map";
import { navigate } from "../../hooks/useHashRoute";
import { hikePaths, navigateTab } from "../hikeRoutes";
import { HikeProgressSheet } from "./components/HikeProgressSheet";
import { useHikeControls } from "./useHikeControls";
import "../hikePages.css";
import "./HikeActivePage.css";

/** HIKE-05 등산 중 (`#hikes/active?alerts=on|off`). 알림 기본값은 HIKE-04 알림 수신 확인에서 고른 값이다. */
export function HikeActivePage() {
  const session = useHikeSession();
  const restoring = useRestoreActiveHike();
  const course = session ? findCourse(session.schedule.courseId) : undefined;
  const hike = useMemo(() => course ? initialHikeProgress(course, session?.phase === "downhill") : null, [course, session?.phase]);
  const [filter, setFilter] = useState<SpotFilter>("all");
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const [recenterKey, setRecenterKey] = useState(0);
  const alertsOn = session?.alertsOn ?? false;
  const [overlay, setOverlay] = useState<"share" | "end" | null>(null);
  const controls = useHikeControls(session);
  const finish = () => void controls.finish();
  if (!session && restoring) return <main className="hike-page__empty-state"><p>진행 중인 등산을 불러오는 중이에요.</p></main>;
  if (!session || !hike || session.phase === "complete") return <main className="hike-page__empty-state">
    <p>진행 중인 등산이 없어요.</p><Button label="오늘의 등산 보기" onClick={() => navigate(hikePaths.today)} /></main>;

  return <div className="hike-page hike-map-page hike-active-page">
    <main className="hike-page__body hike-map-page__body">
      <div className="hike-map-page__map">
        <HikeRouteMap route={hike.route} peak={hike.peak} traveledKm={controls.traveledKm ?? hike.traveledKm}
          {...controls.tracking ? { position: session.currentPosition, traveledPath: session.traveledPath } : { currentIndex: hike.currentIndex }}
          spots={hike.spots} filter={filter} dimension={dimension} recenterKey={recenterKey}
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
      </div>
      <HikeProgressSheet stage={session.phase === "downhill" ? "descent" : "ascent"} courseName={hike.courseName}
        traveledKm={controls.traveledKm ?? hike.traveledKm} remainingKm={hike.remainingKm} sunset={hike.sunset}
        alertsOn={alertsOn} onAlertsChange={setHikeAlerts}
        onStartDescent={() => void controls.descend(alertsOn)}
        onEnd={() => {
          if (session.phase === "downhill") finish();
          else setOverlay("end");
        }} />
    </main>
    <BottomNavigation className="hike-page__nav" active="home" onNavigate={navigateTab} />
    {controls.message && <Toast className="hike-page__toast" message={controls.message} />}

    {overlay === "share" && <HikeShareSheet onClose={() => setOverlay(null)} onShareSpot={() => {
      setOverlay(null);
      const query = new URLSearchParams({ screen: "spotPicker", mode: "active", mountain: session.mountainId,
        course: session.schedule.courseId,
        returnTo: session.phase === "downhill" ? hikePaths.downhill(alertsOn) : hikePaths.active(alertsOn) });
      navigate(`community?${query}`);
    }} />}
    {overlay === "end" && <HikeEndConfirm onCancel={() => setOverlay(null)}
      onConfirm={finish} />}
  </div>;
}
