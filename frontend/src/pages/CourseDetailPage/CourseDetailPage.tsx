import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/common/Button";
import { Icon } from "../../components/common/Icon";
import { BottomNavigation, TabBar, TopBar, type BottomDestination } from "../../components/layout";
import { BottomSheet } from "../../components/overlay";
import { EmptyState, Toast } from "../../components/feedback";
import { CourseRouteMap } from "../../components/map/CourseRouteMap";
import { courseDetailPath } from "../../routes/courseDetailRoutes";
import { coursePaths } from "../../routes/courseRoutes";
import { homePaths, navigateFromHome } from "../../routes/homeRoutes";
import { setCourseSaved, useSavedCourseIds } from "../../store/courseSelectionStore";
import type { CourseRequest } from "../../types/course";
import type { CourseDetailView, CourseSpot, CourseSpotRequest, ProfileVisibility } from "../../types/courseDetail";
import { nearestProfileIndex, selectCourseSpots, toggleProfileMetric } from "../../utils/courseProfile";
import { CourseAnalysis } from "./components/CourseAnalysis";
import { CourseSpots } from "./components/CourseSpots";
import { useCourseDetail } from "./hooks/useCourseDetail";
import { useDetailSheet } from "./hooks/useDetailSheet";
import "./course-detail.css";

export type CourseDetailPageProps = CourseRequest & {
  view?: CourseDetailView;
  scheduleRequested?: boolean;
  hasSchedule?: boolean;
  onBack?: () => void;
  onSpotOpen?: (request: CourseSpotRequest) => void;
  onScheduleOpen?: (request: CourseRequest) => void;
};
const DEFAULT_VIEW: CourseDetailView = { tab: "analysis", category: "all" };
const savedBagAsset = new URL("../../assets/icons/bag-selected.svg", import.meta.url).href;

export function CourseDetailPage({ mountainId, courseId, view = DEFAULT_VIEW, scheduleRequested = false, hasSchedule = false,
  onBack, onSpotOpen, onScheduleOpen }: CourseDetailPageProps) {
  const request = { mountainId, courseId };
  const { state, toast, notify, retry } = useCourseDetail(request);
  const { rootRef, sheetTop, style: sheetStyle, handleProps } = useDetailSheet();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [visibility, setVisibility] = useState<ProfileVisibility>({ elevation: true, slope: true });
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const savedIds = useSavedCourseIds();
  const saved = savedIds.includes(courseId);
  const data = state.status === "success" ? state.data : null;
  const courses = useMemo(() => data ? [data.course] : [], [data]);
  const spots = useMemo(() => selectCourseSpots(data?.spots ?? [], view.category), [data, view.category]);
  const summitCoordinate = useMemo(() => data?.samples.reduce<(typeof data.samples)[number] | null>((highest, sample) =>
    !highest || sample.elevationMeters > highest.elevationMeters ? sample : highest, null)?.coordinate, [data]);
  const selectedIndex = data ? Math.min(chosenIndex ?? nearestProfileIndex(data.samples, 2.4), data.samples.length - 1) : -1;
  const sample = data?.samples[selectedIndex] ?? null;
  const selectedSpot = spots.find(spot => spot.id === view.spotId) ?? spots[0];
  const back = onBack ?? (() => navigateFromHome(coursePaths.list(mountainId, courseId)));
  useEffect(() => {
    if (scheduleRequested) notify("일정 등록 화면은 담당 작업과 통합 후 연결됩니다.");
  }, [scheduleRequested, notify]);

  function changeView(next: CourseDetailView) { navigateFromHome(courseDetailPath(request, next)); }
  function toggleMetric(key: keyof ProfileVisibility) {
    const next = toggleProfileMetric(visibility, key);
    if (next === visibility) notify("고도 또는 경사도 중 하나는 선택해 주세요.");
    else setVisibility(next);
  }
  function save() {
    setCourseSaved(courseId, !saved);
    notify(saved ? "장바구니에서 뺐어요." : "장바구니에 담았어요.");
  }
  function schedule() {
    if (onScheduleOpen) onScheduleOpen(request);
    else {
      const path = courseDetailPath(request, view);
      navigateFromHome(coursePaths.schedule(request) + (path.includes("?") ? path.slice(path.indexOf("?")) : ""));
      notify("일정 등록 화면은 담당 작업과 통합 후 연결됩니다.");
    }
  }
  function openSpot(spot: CourseSpot) {
    const next = { ...view, spotId: spot.id };
    const returnPath = courseDetailPath(request, next);
    changeView(next);
    if (onSpotOpen) onSpotOpen({ ...request, spotId: spot.id, category: view.category, returnPath });
    else notify("스팟 후기 화면은 커뮤니티 작업과 통합 후 연결됩니다.");
  }
  function navigateTab(destination: BottomDestination) {
    if (destination === "home") navigateFromHome(homePaths.home);
    else notify("이 기능은 다음 단계에서 연결됩니다.");
  }

  return <main ref={rootRef} className="course-detail-page" style={sheetStyle} aria-label="코스 상세 화면"
    onKeyDown={event => {
      if (event.key === "Escape" && view.tab === "spots") {
        event.preventDefault(); changeView({ ...view, tab: "analysis" });
        requestAnimationFrame(() => tabsRef.current?.querySelector<HTMLButtonElement>('[role="tab"]')?.focus());
      }
    }}>
    {data ? <>
      <div className="course-detail-page__map" style={{ height: sheetTop + 4 }}>
        <CourseRouteMap variant="detail" courses={courses} selected={data.course} center={data.course.routeCoordinates[0]}
          onSelect={() => {}} onNotify={notify} summitCoordinate={summitCoordinate}
          profileSample={view.tab === "analysis" ? sample : null} spots={view.tab === "spots" ? spots : undefined}
          selectedSpotId={selectedSpot?.id} focusSpotId={view.spotId} showSpotLabels={view.category !== "all"}
          onSpotSelect={spotId => changeView({ ...view, spotId })} />
      </div>
      <TopBar title={`${data.course.name} 상세`} showAction={false} onBack={back} className="course-detail-page__top" />
      <BottomSheet title="코스 정보" showClose={false} showDescription={false} showFooter className="course-detail-sheet"
        handleProps={handleProps} headerAction={<div ref={tabsRef} className="course-detail-sheet__tabs">
          <TabBar variant="segmented" aria-label="코스 정보" value={view.tab}
            items={[{ value: "analysis", label: "코스 상세", controls: "course-analysis-panel" }, { value: "spots", label: "스팟·통제정보", controls: "course-spots-panel" }]}
            onValueChange={tab => changeView({ ...view, tab: tab === "spots" ? "spots" : "analysis" })} />
        </div>} content={view.tab === "analysis"
          ? <CourseAnalysis data={data} visibility={visibility} selectedIndex={selectedIndex} onSelect={setChosenIndex} onToggle={toggleMetric} />
          : <CourseSpots spots={spots} category={view.category} selectedId={selectedSpot?.id}
            onCategory={category => changeView({ tab: "spots", category })} onOpen={openSpot} />}
        footer={<div className="course-detail-actions">
          <Button variant="secondary" aria-pressed={saved} onClick={save}
            leadingIcon={saved ? <img src={savedBagAsset} alt="" /> : <Icon name="Bag" size={17} color="currentColor" />}>{saved ? "장바구니 담김" : "장바구니 담기"}</Button>
          <Button onClick={schedule}>{hasSchedule ? "일정 변경 →" : "일정 등록 →"}</Button>
        </div>} />
    </> : <div className="course-detail-page__status">
      <TopBar title="코스 상세" showAction={false} onBack={back} className="course-detail-page__top" />
      {state.status === "loading" ? <p role="status">코스 정보를 불러오는 중이에요.</p> : <>
        <EmptyState title={state.status === "missing" ? "코스 정보를 찾을 수 없어요." : "코스를 불러오지 못했어요."}
          description={state.status === "missing" ? "코스 목록에서 다시 선택해 주세요." : "잠시 후 다시 시도해 주세요."} showIcon={false} />
        <Button onClick={state.status === "missing" ? back : retry}>{state.status === "missing" ? "코스 목록으로" : "다시 시도"}</Button>
      </>}
    </div>}
    <BottomNavigation active="home" onNavigate={navigateTab} className="course-detail-page__nav" />
    {toast && <Toast key={toast.id} message={toast.message} className="course-detail-page__toast" />}
  </main>;
}
