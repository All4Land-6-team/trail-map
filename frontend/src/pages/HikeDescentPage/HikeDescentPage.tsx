import { findCourse } from "../../api/hikeMock";
import { useMemo, useState } from "react";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/feedback";
import { useHikeSession } from "../../store/hikeSessionStore";
import { useRestoreActiveHike } from "../../store/hikeSessionRestore";
import { activeHikeFor } from "../../utils/activeHike";
import { HikeEndConfirm, HikeFloatingControls, HikeRouteMap, HikeStatusHUD, HikeSunsetNotice, SunArc } from "../../components/hike";
import { TopBar } from "../../components/layout";
import { MapAction } from "../../components/map";
import { navigate, readHashParams } from "../../hooks/useHashRoute";
import { useSunTimes } from "../../hooks/useSunTimes";
import { useHikeControls } from "../HikeActivePage/useHikeControls";
import { hikePaths } from "../hikeRoutes";
import "../hikePages.css";
import "../HikeActivePage/HikeActivePage.css";

const MAP_PADDING = { top: 130, bottom: 280, left: 40, right: 72 };

/** HIKE-07 하산 중 (`#hikes/downhill`). 진입: HIKE-05 하산 시작 */
export function HikeDescentPage() {
  const session = useHikeSession();
  const restoring = useRestoreActiveHike();
  const course = session ? findCourse(session.schedule.courseId) : undefined;
  const hike = useMemo(() => activeHikeFor(course, session?.schedule, session?.coursePath, session?.phase === "downhill"),
    [course, session?.schedule, session?.coursePath, session?.phase]);
  const alertsParam = readHashParams().get("alerts");
  const controls = useHikeControls(session, hike);
  // 등산 중 화면과 같이 3D 내비 모드로 시작한다. 2D는 경로 전체 보기다.
  const [dimension, setDimension] = useState<"2D" | "3D">("3D");
  const [recenterKey, setRecenterKey] = useState(0);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const routeCenter = controls.route[Math.floor(controls.route.length / 2)];
  const sun = useSunTimes(session?.currentPosition ?? routeCenter);
  if (!session && restoring) return <main className="hike-page__empty-state"><p>진행 중인 등산을 불러오는 중이에요.</p></main>;
  if (!session || !hike || session.phase === "complete") return <main className="hike-page__empty-state">
    <p>진행 중인 등산이 없어요.</p><Button label="오늘의 등산 보기" onClick={() => navigate(hikePaths.today)} /></main>;

  return <div className="hike-page hike-map-page hike-descent-page">
    <main className="hike-page__body hike-map-page__body">
      <div className="hike-map-page__map">
        <HikeRouteMap route={controls.route} peak={controls.peak} mountainName={hike.mountainName}
          traveledKm={controls.traveledKm ?? hike.traveledKm} spots={hike.spots}
          {...controls.tracking ? { position: session.currentPosition, traveledPath: controls.mapPath } : { currentIndex: hike.currentIndex }}
          progressMeters={controls.progressMeters} stage="descent" navigation
          padding={MAP_PADDING} dimension={dimension} recenterKey={recenterKey} label={`${hike.courseName} 하산 경로 지도`} />
        <div className="hike-map-page__top">
          <TopBar title="하산 중" showAction={false}
            onBack={() => navigate(hikePaths.active(alertsParam !== "off"))} />
        </div>
        <div className="hike-map-page__tools">
          <MapAction iconName="3D" dimensionMode={dimension} onDimensionModeChange={setDimension}
            aria-label={dimension === "3D" ? "2D 지도로 전환" : "3D 지도로 전환"} />
          <MapAction aria-label="현재 위치로 이동" onClick={() => setRecenterKey(key => key + 1)} />
        </div>
        <div className="hike-active-page__bottom">
          <HikeStatusHUD stage="descent" courseName={hike.courseName}
            courseNotice={controls.courseNotice} paused={controls.paused} />
          <HikeSunsetNotice sun={sun} />
          <div className="hike-sun-controls">
            <SunArc sun={sun} variant="compact" />
            <HikeFloatingControls state={controls.paused ? "paused" : "recording"} busy={controls.busy} showMain={false}
              secondaryLabel="등산 종료" onMain={controls.togglePaused} onSecondary={() => setConfirmingEnd(true)} />
          </div>
        </div>
      </div>
    </main>
    {controls.message && <Toast className="hike-page__toast" message={controls.message} />}
    {confirmingEnd && <HikeEndConfirm onCancel={() => setConfirmingEnd(false)} onConfirm={controls.finish} />}
  </div>;
}
