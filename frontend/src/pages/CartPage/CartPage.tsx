import { lazy, Suspense, useEffect, useMemo } from "react";
import type { BottomDestination } from "../../components/layout";
import { useSavedCourseIds } from "../../store/courseSelectionStore";
import { navigate } from "../../hooks/useHashRoute";
import { cartCourseDetailPath } from "../../routes/courseDetailRoutes";
import { cartCatalog } from "./catalog";
import { CartHomeScreen } from "./components/CartHomeScreen";
import { CourseSelectionScreen } from "./components/CourseSelectionScreen";
import { limitComparisonCourseIds, toggleComparisonCourseId } from "./data";
import type { PlannedHike } from "../../types/hiking";
import { useCourseComparison } from "./hooks/useCourseComparison";
import { comparisonCourseViews } from "../../utils/courseComparison";
import type { CartCourse } from "./types";
import "./cart.css";

const CourseCompareScreen = lazy(() => import("./components/CourseCompareScreen").then(({ CourseCompareScreen: Screen }) => ({ default: Screen })));
const ComparisonMetricsScreen = lazy(() => import("./components/ComparisonMetricsScreen").then(({ ComparisonMetricsScreen: Screen }) => ({ default: Screen })));

// 지도↔비교표 이동 동안 같은 요청·분석 ID를 유지한다. 코스 선택을 바꾸면 hook이 이전 요청을 취소한다.
function ConnectedComparison({ courses, metrics, onBack, onViewMetrics, onCourseDetail, onKeepCart,
  onNavigate, plannedHikes, onPlanHike }: {
  courses: readonly CartCourse[]; metrics: boolean; onBack: () => void; onViewMetrics: () => void;
  onCourseDetail: (id: string) => void; onKeepCart: () => void; onNavigate: (destination: BottomDestination) => void;
  plannedHikes: readonly PlannedHike[]; onPlanHike: (hike: PlannedHike) => void;
}) {
  const { state, retry } = useCourseComparison(courses);
  const analysisCourses = useMemo(() => comparisonCourseViews(courses, state), [courses, state]);
  const common = { courses, analysisCourses, analysisState: state, onRetry: retry, onNavigate, onBack };
  return <Suspense fallback={<main aria-busy="true">비교 화면을 불러오는 중이에요</main>}>
    {metrics ? <ComparisonMetricsScreen {...common} onCourseDetail={onCourseDetail} onKeepCart={onKeepCart}
      plannedHikes={plannedHikes} onPlanHike={onPlanHike} />
      : <CourseCompareScreen {...common} onViewMetrics={onViewMetrics} />}
  </Suspense>;
}

type CartPageProps = {
  route: string;
  onNavigateOutsideCart: (destination: BottomDestination) => void;
  plannedHikes: readonly PlannedHike[];
  onPlanHike: (plannedHike: PlannedHike) => void;
};

function LegacyCartCourseRedirect({ path }: { path: string }) {
  useEffect(() => navigate(path), [path]);
  return <main className="app-route-loading" aria-busy="true">공통 코스 상세 화면으로 이동 중이에요</main>;
}

export function CartPage({ route, onNavigateOutsideCart, plannedHikes, onPlanHike }: CartPageProps) {
  const savedIds = useSavedCourseIds();
  const saved = cartCatalog.filter(course => savedIds.includes(course.id));
  const [path, search] = route.replace(/^#/, "").split("?");
  const query = new URLSearchParams(search);
  const mountainId = query.get("mountain") ?? (path.startsWith("cart/mountain/") ? path.slice(14) : "bukhansan");
  const courses = saved.filter(course => course.mountainId === mountainId);
  const requestedIds = query.has("selected") ? query.get("selected")!.split(",") : courses.map(course => course.id);
  const selectedIds = new Set(limitComparisonCourseIds(courses.map(course => course.id), requestedIds));
  const selected = courses.filter(course => selectedIds.has(course.id));
  const context = new URLSearchParams({ mountain: mountainId, selected: selected.map(course => course.id).join(",") });
  const selectionPath = `cart/mountain/${mountainId}?${context}`;
  const comparePath = `cart/compare?${context}`;
  const metricsPath = `cart/metrics?${context}`;
  const nav = onNavigateOutsideCart;
  const home = <CartHomeScreen courses={path === "cart/empty" ? [] : saved} onBrowseMountains={() => nav("home")}
    onNavigate={nav} onSelectMountain={id => navigate(`cart/mountain/${id}`)} />;
  const detail = (id: string, from = "selection") => navigate(cartCourseDetailPath(
    { mountainId, courseId: id }, from === "metrics" ? metricsPath : selectionPath,
  ));

  if (path.startsWith("cart/course/")) {
    const course = saved.find(item => encodeURIComponent(item.id) === path.slice(12));
    if (!course) return home;
    const returnTo = query.get("from") === "metrics" ? metricsPath : selectionPath;
    return <LegacyCartCourseRedirect path={cartCourseDetailPath(
      { mountainId: course.mountainId ?? mountainId, courseId: course.id }, returnTo,
    )} />;
  }
  if (!courses.length) return home;
  if (path === "cart/bukhansan" || path.startsWith("cart/mountain/") || ((path === "cart/compare" || path === "cart/metrics") && selected.length < 2)) {
    return <CourseSelectionScreen courses={courses} selectedCourseIds={selectedIds} onBack={() => navigate("cart")}
      onCompare={() => navigate(comparePath)} onCourseDetail={id => detail(id)} onNavigate={nav}
      onToggleCourse={id => {
        const next = toggleComparisonCourseId(selectedIds, id);
        if (!next) return;
        context.set("selected", [...next].join(","));
        navigate(`cart/mountain/${mountainId}?${context}`);
      }} />;
  }
  if (path === "cart/compare" || path === "cart/metrics") return <ConnectedComparison
    courses={selected} metrics={path === "cart/metrics"}
    onBack={() => navigate(path === "cart/metrics" ? comparePath : selectionPath)}
    onViewMetrics={() => navigate(metricsPath)} onCourseDetail={id => detail(id, "metrics")}
    onKeepCart={() => navigate("cart")} onNavigate={nav} plannedHikes={plannedHikes} onPlanHike={onPlanHike} />;
  return home;
}
