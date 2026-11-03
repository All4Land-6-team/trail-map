import { findCourse } from "../../api/hikeMock";
import { useMemo } from "react";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/feedback";
import { useHikeSession } from "../../store/hikeSessionStore";
import { useRestoreActiveHike } from "../../store/hikeSessionRestore";
import { activeHikeFor } from "../../utils/activeHike";
import { HikeRouteMap } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { navigate, readHashParams } from "../../hooks/useHashRoute";
import { HikeProgressSheet } from "../HikeActivePage/components/HikeProgressSheet";
import { useHikeControls } from "../HikeActivePage/useHikeControls";
import { hikePaths, navigateTab } from "../hikeRoutes";
import "../hikePages.css";
import "../HikeActivePage/HikeActivePage.css";

const MAP_PADDING = { top: 110, bottom: 60, left: 50, right: 50 };

/** HIKE-07 하산 중 (`#hikes/downhill`). 진입: HIKE-05 하산 시작 */
export function HikeDescentPage() {
  const session = useHikeSession();
  const restoring = useRestoreActiveHike();
  const course = session ? findCourse(session.schedule.courseId) : undefined;
  const hike = useMemo(() => activeHikeFor(course, session?.schedule, session?.coursePath, session?.phase === "downhill"),
    [course, session?.schedule, session?.coursePath, session?.phase]);
  const alertsParam = readHashParams().get("alerts");
  const controls = useHikeControls(session, hike);
  if (!session && restoring) return <main className="hike-page__empty-state"><p>진행 중인 등산을 불러오는 중이에요.</p></main>;
  if (!session || !hike || session.phase === "complete") return <main className="hike-page__empty-state">
    <p>진행 중인 등산이 없어요.</p><Button label="오늘의 등산 보기" onClick={() => navigate(hikePaths.today)} /></main>;

  return <div className="hike-page hike-map-page hike-descent-page">
    <main className="hike-page__body hike-map-page__body">
      <div className="hike-map-page__map">
        <HikeRouteMap route={controls.route} peak={controls.peak}
          {...controls.tracking ? { position: session.currentPosition, traveledPath: controls.mapPath } : { currentIndex: hike.currentIndex }}
          padding={MAP_PADDING} label={`${hike.courseName} 하산 경로 지도`} />
        <div className="hike-map-page__top">
          <TopBar title="하산 중" showAction={false}
            onBack={() => navigate(hikePaths.active(alertsParam !== "off"))} />
        </div>
      </div>
      {/* Figma 메모: 하산 중 등산 종료는 확인 창 없이 완료로 이동한다 */}
      <HikeProgressSheet stage="descent" courseName={hike.courseName}
        traveledKm={controls.traveledKm ?? hike.traveledKm} remainingKm={controls.remainingKm}
        progressPercent={controls.progressPercent} courseNotice={controls.courseNotice} sunset={hike.sunset}
        onEnd={() => void controls.finish()} />
    </main>
    <BottomNavigation className="hike-page__nav" active="myHikes" onNavigate={navigateTab} />
    {controls.message && <Toast className="hike-page__toast" message={controls.message} />}
  </div>;
}
