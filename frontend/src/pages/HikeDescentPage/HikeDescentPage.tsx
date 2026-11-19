import { findCourse } from "../../api/hikeMock";
import { useMemo, useState } from "react";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/feedback";
import { hikeTargetIds, setHikeAlerts, useHikeSession } from "../../store/hikeSessionStore";
import { useRestoreActiveHike } from "../../store/hikeSessionRestore";
import { activeHikeFor } from "../../utils/activeHike";
import { HikeEndConfirm, HikeProgressPanel, HikeRouteMap, HikeShareSheet, HikeSunsetNotice, SpotFilterChips, SunArc, type SpotFilter } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { MapAction, MapCompassAction } from "../../components/map";
import { navigate, readHashParams } from "../../hooks/useHashRoute";
import { useSunTimes } from "../../hooks/useSunTimes";
import { useHikeControls } from "../HikeActivePage/useHikeControls";
import { hikePaths, navigateTab } from "../hikeRoutes";
import "../hikePages.css";
import "../HikeActivePage/HikeActivePage.css";

const MAP_PADDING = { top: 150, bottom: 320, left: 40, right: 72 };

/** HIKE-07 하산 중 (`#hikes/downhill`). 진입: HIKE-05 하산 시작 */
export function HikeDescentPage() {
  const session = useHikeSession();
  const restoring = useRestoreActiveHike();
  const course = session ? findCourse(session.schedule.courseId) : undefined;
  const hike = useMemo(() => activeHikeFor(course, session?.schedule, session?.coursePath, session?.phase === "downhill"),
    [course, session?.schedule, session?.coursePath, session?.phase]);
  const alertsParam = readHashParams().get("alerts");
  const alertsOn = session?.alertsOn ?? alertsParam !== "off";
  const controls = useHikeControls(session, hike);
  const [filter, setFilter] = useState<SpotFilter>("all");
  // 등산 중 화면과 같이 3D 내비 모드로 시작한다. 2D는 경로 전체 보기다.
  const [dimension, setDimension] = useState<"2D" | "3D">("3D");
  const [recenterKey, setRecenterKey] = useState(0);
  const [overlay, setOverlay] = useState<"share" | "end" | null>(null);
  const routeCenter = controls.route[Math.floor(controls.route.length / 2)];
  const sun = useSunTimes(session?.currentPosition ?? routeCenter);
  if (!session && restoring) return <main className="hike-page__empty-state"><p>진행 중인 등산을 불러오는 중이에요.</p></main>;
  if (!session || !hike || session.phase === "complete") return <main className="hike-page__empty-state">
    <p>진행 중인 등산이 없어요.</p><Button label="오늘의 등산 보기" onClick={() => navigate(hikePaths.today)} /></main>;

  return <div className="hike-page hike-map-page hike-descent-page">
    <main className="hike-page__body hike-map-page__body">
      <div className="hike-map-page__map">
        <HikeRouteMap route={controls.route} peak={controls.peak} mountainName={hike.mountainName}
          traveledKm={controls.traveledKm ?? hike.traveledKm} spots={hike.spots} filter={filter}
          {...controls.tracking ? { position: session.currentPosition, traveledPath: controls.mapPath } : { currentIndex: hike.currentIndex }}
          progressMeters={controls.progressMeters} stage="descent" navigation
          padding={MAP_PADDING} dimension={dimension} recenterKey={recenterKey} label={`${hike.courseName} 하산 경로 지도`} />
        <div className="hike-map-page__top">
          <TopBar title="하산 중" subtitle={hike.courseName} showAction={false}
            onBack={() => navigate(hikePaths.active(alertsOn))} />
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
        <div className="hike-active-page__sun">
          <SunArc sun={sun} variant="compact" />
        </div>
      </div>
      <HikeProgressPanel stage="descent" traveledKm={controls.traveledKm ?? hike.traveledKm} remainingKm={controls.remainingKm}
        progressPercent={controls.progressPercent} courseNotice={controls.courseNotice} busy={controls.busy}
        onEnd={() => setOverlay("end")} />
    </main>
    <BottomNavigation className="hike-page__nav" active="myHikes" onNavigate={navigateTab} />
    {controls.message && <Toast className="hike-page__toast" message={controls.message} />}

    {overlay === "share" && <HikeShareSheet onClose={() => setOverlay(null)} onShareSpot={() => {
      setOverlay(null);
      const target = hikeTargetIds(session);
      const query = new URLSearchParams({ screen: "spotPicker", mode: "active", course: target.courseId,
        returnTo: hikePaths.downhill(alertsOn) });
      if (target.mountainId) query.set("mountain", target.mountainId);
      navigate(`community?${query}`);
    }} />}
    {overlay === "end" && <HikeEndConfirm onCancel={() => setOverlay(null)} onConfirm={controls.finish} />}
  </div>;
}
