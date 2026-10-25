import { findCourse } from "../../api/hikeMock";
import { completeHikeSchedule } from "../../api/hikeScheduleApi";
import { useMemo, useState } from "react";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/feedback";
import { finishHikeSession, useHikeSession } from "../../store/hikeSessionStore";
import { initialHikeProgress } from "../../utils/activeHike";
import { HikeRouteMap } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { navigate, readHashParams } from "../../hooks/useHashRoute";
import { HikeProgressSheet } from "../HikeActivePage/components/HikeProgressSheet";
import { hikePaths, navigateTab } from "../hikeRoutes";
import "../hikePages.css";
import "../HikeActivePage/HikeActivePage.css";

const MAP_PADDING = { top: 110, bottom: 60, left: 50, right: 50 };

/** HIKE-07 하산 중 (`#hikes/downhill`). 진입: HIKE-05 하산 시작 */
export function HikeDescentPage() {
  const session = useHikeSession();
  const course = session ? findCourse(session.schedule.courseId) : undefined;
  const hike = useMemo(() => course ? initialHikeProgress(course, session?.phase === "downhill") : null, [course, session?.phase]);
  const alertsParam = readHashParams().get("alerts");
  const [finishError, setFinishError] = useState("");
  const finish = () => {
    setFinishError("");
    void (session?.schedule.scheduleId === undefined
      ? Promise.resolve()
      : completeHikeSchedule(session.schedule.scheduleId))
      .then(() => { finishHikeSession(); navigate(hikePaths.complete); })
      .catch(() => setFinishError("등산 완료 기록을 저장하지 못했어요. 다시 시도해 주세요."));
  };
  if (!session || !hike || session.phase === "complete") return <main className="hike-page__empty-state">
    <p>진행 중인 등산이 없어요.</p><Button label="오늘의 등산 보기" onClick={() => navigate(hikePaths.today)} /></main>;

  return <div className="hike-page hike-map-page hike-descent-page">
    <main className="hike-page__body hike-map-page__body">
      <div className="hike-map-page__map">
        <HikeRouteMap route={hike.route} peak={hike.peak} currentIndex={hike.currentIndex}
          padding={MAP_PADDING} label={`${hike.courseName} 하산 경로 지도`} />
        <div className="hike-map-page__top">
          <TopBar title="하산 중" showAction={false}
            onBack={() => navigate(hikePaths.active(alertsParam !== "off"))} />
        </div>
      </div>
      {/* Figma 메모: 하산 중 등산 종료는 확인 창 없이 완료로 이동한다 */}
      <HikeProgressSheet stage="descent" courseName={hike.courseName}
        traveledKm={hike.traveledKm} remainingKm={hike.remainingKm} sunset={hike.sunset}
        onEnd={finish} />
    </main>
    <BottomNavigation className="hike-page__nav" active="myHikes" onNavigate={navigateTab} />
    {finishError && <Toast className="hike-page__toast" message={finishError} />}
  </div>;
}
