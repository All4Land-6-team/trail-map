import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/common/Button";
import { Icon } from "../../components/common/Icon";
import { BottomNavigation, TabBar, TopBar, type BottomDestination } from "../../components/layout";
import { BottomSheet } from "../../components/overlay";
import { EmptyState, Toast } from "../../components/feedback";
import { CourseRouteMap } from "../../components/map/CourseRouteMap";
import { courseDetailPath } from "../../routes/courseDetailRoutes";
import { readHashParams } from "../../hooks/useHashRoute";
import { coursePaths } from "../../routes/courseRoutes";
import { communityApi, type CommunityCourseDto, type CommunityReviewDto } from "../../api/community";
import { homePaths, navigateFromHome } from "../../routes/homeRoutes";
import { setCourseSaved, useSavedCourseIds } from "../../store/courseSelectionStore";
import type { CourseRequest } from "../../types/course";
import type { CourseDetailView, CourseSpot, CourseSpotRequest, ProfileVisibility } from "../../types/courseDetail";
import { selectCourseSpots, toggleProfileMetric } from "../../utils/courseProfile";
import { detailAnalysisView } from "../../utils/courseDetailAnalysis";
import { useCourseAnalysis } from "./hooks/useCourseAnalysis";
import { CourseAnalysis } from "./components/CourseAnalysis";
import { CourseSpots } from "./components/CourseSpots";
import { useCourseDetail } from "./hooks/useCourseDetail";
import { useCourseFacilities } from "./hooks/useCourseFacilities";
import { withCourseFacilities } from "../../utils/courseFacilities";
import { useDetailSheet } from "./hooks/useDetailSheet";
import "./course-detail.css";

export type CourseDetailPageProps = CourseRequest & {
  view?: CourseDetailView;
  hasSchedule?: boolean;
  activeDestination?: BottomDestination;
  onBack?: () => void;
  onSpotOpen?: (request: CourseSpotRequest) => void;
  onReviewsOpen?: (request: CourseRequest) => void;
  onScheduleOpen?: (request: CourseRequest) => void;
};
const DEFAULT_VIEW: CourseDetailView = { tab: "analysis", category: "all" };
const EMPTY_SPOTS: readonly CourseSpot[] = [];
const savedBagAsset = new URL("../../assets/icons/bag-selected.svg", import.meta.url).href;

export function CourseDetailPage({ mountainId, courseId, view = DEFAULT_VIEW, hasSchedule = false,
  activeDestination = "home", onBack, onSpotOpen, onReviewsOpen, onScheduleOpen }: CourseDetailPageProps) {
  const request = { mountainId, courseId };
  const returnTo = readHashParams().get("returnTo");
  const { state, toast, notify, retry } = useCourseDetail(request);
  const { rootRef, mapBottomInset, handleProps } = useDetailSheet();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [visibility, setVisibility] = useState<ProfileVisibility>({ elevation: true, slope: true });
  const [selection, setSelection] = useState<{ key: string; index: number } | null>(null);
  const [communityCourse, setCommunityCourse] = useState<CommunityCourseDto | null>(null);
  const [communityReviews, setCommunityReviews] = useState<CommunityReviewDto[]>([]);
  const savedIds = useSavedCourseIds();
  const saved = savedIds.includes(courseId);
  const data = state.status === "success" ? state.data : null;
  const { state: analysisState, retry: retryAnalysis } = useCourseAnalysis(data?.course ?? null);
  const analysisView = useMemo(() => detailAnalysisView(data?.course ?? null, analysisState), [data, analysisState]);
  const { samples } = analysisView;
  const selectionKey = JSON.stringify([mountainId, courseId, analysisView.analysis?.analysisId]);
  const restrooms = useCourseFacilities(courseId, data?.course.backendCourseId,
    view.tab === "spots" && (view.category === "all" || view.category === "restroom"));
  const restroomSpots = restrooms.state.status === "success" ? restrooms.state.spots : EMPTY_SPOTS;
  const water = useCourseFacilities(courseId, data?.course.backendCourseId,
    view.tab === "spots" && (view.category === "all" || view.category === "water"), "DRINKING_WATER");
  const waterSpots = water.state.status === "success" ? water.state.spots : EMPTY_SPOTS;
  const shelters = useCourseFacilities(courseId, data?.course.backendCourseId,
    view.tab === "spots" && (view.category === "all" || view.category === "shelter"), "SHELTER");
  const shelterSpots = shelters.state.status === "success" ? shelters.state.spots : EMPTY_SPOTS;
  const reviewExcerpts = communityReviews.map(review => ({
    id: String(review.reviewId),
    meta: `${review.author} · ${new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(review.createdAt))}`,
    quote: review.content,
  })).slice(0, 2);
  const reviewTotal = communityCourse?.reviewCount ?? communityReviews.length;
  const mapCourse = useMemo(() => data ? { ...data.course, routeCoordinates: analysisView.routeCoordinates } : null, [data, analysisView]);
  const courses = useMemo(() => mapCourse && mapCourse.routeCoordinates.length > 1 ? [mapCourse] : [], [mapCourse]);
  const allSpots = useMemo(() => withCourseFacilities(data?.spots ?? EMPTY_SPOTS, [...restroomSpots, ...waterSpots, ...shelterSpots]),
    [data, restroomSpots, waterSpots, shelterSpots]);
  const spots = useMemo(() => selectCourseSpots(allSpots, view.category), [allSpots, view.category]);
  const summitCoordinate = useMemo(() => samples.reduce<(typeof samples)[number] | null>((highest, point) =>
    point.elevationMeters !== null && (!highest || point.elevationMeters > highest.elevationMeters!) ? point : highest, null)?.coordinate, [samples]);
  const selectedIndex = samples.length ? Math.max(0, Math.min(selection?.key === selectionKey ? selection.index : 0, samples.length - 1)) : -1;
  const sample = samples[selectedIndex] ?? null;
  const selectedSpot = spots.find(spot => spot.id === view.spotId) ?? spots[0];
  const back = onBack ?? (() => navigateFromHome(coursePaths.list(mountainId, courseId)));

  useEffect(() => {
    const controller = new AbortController();
    void communityApi.mountains(controller.signal).then(mountains => {
      const mountain = mountains.find(item => String(item.mountainId) === mountainId || item.externalId === mountainId)
        ?? mountains.find(item => item.name === ({ bukhansan: "북한산", dobongsan: "도봉산", gwanaksan: "관악산" } as Record<string, string>)[mountainId]);
      if (!mountain) return null;
      return communityApi.courses(String(mountain.mountainId), controller.signal);
    }).then(courses => {
      if (!courses) return null;
      const course = courses.find(item => String(item.courseId) === courseId || item.externalId === courseId);
      setCommunityCourse(course ?? null);
      return course ? communityApi.courseReviews(String(course.courseId), controller.signal) : null;
    }).then(reviews => {
      if (reviews) setCommunityReviews(reviews);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setCommunityCourse(null);
        setCommunityReviews([]);
      }
    });
    return () => controller.abort();
  }, [courseId, mountainId]);

  function changeView(next: CourseDetailView) { navigateFromHome(courseDetailPath(request, next, returnTo)); }
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
    }
  }
  function openSpot(spot: CourseSpot) {
    const next = { ...view, spotId: spot.id };
    if (spot.facilityId !== undefined) { changeView(next); return; }
    const returnPath = courseDetailPath(request, next, returnTo);
    if (onSpotOpen) onSpotOpen({ ...request, spotId: spot.id, category: view.category, returnPath });
    else notify("스팟 후기 화면은 커뮤니티 작업과 통합 후 연결됩니다.");
  }
  function navigateTab(destination: BottomDestination) {
    navigateFromHome(homePaths[destination]);
  }

  return <main ref={rootRef} className="course-detail-page" aria-label="코스 상세 화면"
    onKeyDown={event => {
      if (event.key === "Escape" && view.tab === "spots") {
        event.preventDefault(); changeView({ ...view, tab: "analysis" });
        requestAnimationFrame(() => tabsRef.current?.querySelector<HTMLButtonElement>('[role="tab"]')?.focus());
      }
    }}>
    {data ? <>
      <div className="course-detail-page__map">
        <CourseRouteMap variant="detail" courses={courses} selected={mapCourse} mountainId={request.mountainId}
          mapBottomInset={mapBottomInset}
          center={data.course.routeCoordinates[0]}
          onSelect={() => {}} onNotify={notify} summitCoordinate={summitCoordinate} summitLabel="최고 고도"
          dataLabel={analysisState.status === "loading" ? "분석 경로 조회 중" : !samples.length
            ? "분석 경로 없음" : analysisView.development ? "개발용 예시 경로" : null}
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
          ? <CourseAnalysis data={data} analysisState={analysisState} analysisView={analysisView} onRetryAnalysis={retryAnalysis}
            reviews={reviewExcerpts} reviewTotal={reviewTotal} visibility={visibility} selectedIndex={selectedIndex}
            onSelect={index => setSelection({ key: selectionKey, index })} onToggle={toggleMetric} onReviewsOpen={onReviewsOpen ? () => onReviewsOpen(request) : undefined} />
          : <CourseSpots spots={spots} category={view.category} selectedId={selectedSpot?.id}
            restrooms={restrooms.state} onRetryRestrooms={restrooms.retry}
            water={water.state} onRetryWater={water.retry}
            shelters={shelters.state} onRetryShelters={shelters.retry}
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
    <BottomNavigation active={activeDestination} onNavigate={navigateTab} className="course-detail-page__nav" />
    {toast && <Toast key={toast.id} message={toast.message} className="course-detail-page__toast" />}
  </main>;
}
