import { lazy, Suspense } from "react";
import type { BottomDestination } from "../../components/layout";
import { useSavedCourseIds } from "../../store/courseSelectionStore";
import { navigate } from "../../hooks/useHashRoute";
import { cartCatalog } from "./catalog";
import { CartHomeScreen } from "./components/CartHomeScreen";
import { CourseSelectionScreen } from "./components/CourseSelectionScreen";
import type { PlannedHike } from "../../types/hiking";
import "./cart.css";

const CourseCompareScreen = lazy(() => import("./components/CourseCompareScreen").then(({ CourseCompareScreen: Screen }) => ({ default: Screen })));
const CourseDetailScreen = lazy(() => import("./components/CourseDetailScreen").then(({ CourseDetailScreen: Screen }) => ({ default: Screen })));
const ComparisonMetricsScreen = lazy(() => import("./components/ComparisonMetricsScreen").then(({ ComparisonMetricsScreen: Screen }) => ({ default: Screen })));

type CartPageProps = {
  route: string;
  onNavigateOutsideCart: (destination: BottomDestination) => void;
  plannedHikes: readonly PlannedHike[];
  onPlanHike: (plannedHike: PlannedHike) => void;
};

export function CartPage({ route, onNavigateOutsideCart, plannedHikes, onPlanHike }: CartPageProps) {
  const savedIds = useSavedCourseIds();
  const saved = cartCatalog.filter(course => savedIds.includes(course.id));
  const [path, search] = route.replace(/^#/, "").split("?");
  const query = new URLSearchParams(search);
  const mountainId = query.get("mountain") ?? (path.startsWith("cart/mountain/") ? path.slice(14) : "bukhansan");
  const courses = saved.filter(course => course.mountainId === mountainId);
  const selectedIds = new Set(query.has("selected") ? query.get("selected")!.split(",") : courses.map(course => course.id));
  const selected = courses.filter(course => selectedIds.has(course.id));
  const context = new URLSearchParams({ mountain: mountainId, selected: selected.map(course => course.id).join(",") });
  const selectionPath = `cart/mountain/${mountainId}?${context}`;
  const comparePath = `cart/compare?${context}`;
  const metricsPath = `cart/metrics?${context}`;
  const nav = onNavigateOutsideCart;
  const home = <CartHomeScreen courses={path === "cart/empty" ? [] : saved} onBrowseMountains={() => nav("home")}
    onNavigate={nav} onSelectMountain={id => navigate(`cart/mountain/${id}`)} />;
  const detail = (id: string, from = "selection") => navigate(`cart/course/${encodeURIComponent(id)}?${context}&from=${from}`);

  if (path.startsWith("cart/course/")) {
    const course = saved.find(item => encodeURIComponent(item.id) === path.slice(12));
    if (!course) return home;
    return <Suspense fallback={<main aria-busy="true">상세 화면을 불러오는 중이에요</main>}>
      <CourseDetailScreen course={course} onBack={() => navigate(query.get("from") === "metrics" ? metricsPath : selectionPath)}
        onKeepCart={() => navigate("cart")} onNavigate={nav} plannedHikes={plannedHikes} onPlanHike={onPlanHike} />
    </Suspense>;
  }
  if (!courses.length) return home;
  if (path === "cart/bukhansan" || path.startsWith("cart/mountain/") || ((path === "cart/compare" || path === "cart/metrics") && selected.length < 2)) {
    return <CourseSelectionScreen courses={courses} selectedCourseIds={selectedIds} onBack={() => navigate("cart")}
      onCompare={() => navigate(comparePath)} onCourseDetail={id => detail(id)} onNavigate={nav}
      onToggleCourse={id => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        context.set("selected", [...next].join(","));
        navigate(`cart/mountain/${mountainId}?${context}`);
      }} />;
  }
  if (path === "cart/compare" || path === "cart/metrics") return <Suspense fallback={<main aria-busy="true">비교 화면을 불러오는 중이에요</main>}>
    {path === "cart/compare" ? <CourseCompareScreen courses={selected} onBack={() => navigate(selectionPath)}
      onViewMetrics={() => navigate(metricsPath)} onNavigate={nav} />
      : <ComparisonMetricsScreen courses={selected} onBack={() => navigate(comparePath)}
        onCourseDetail={id => detail(id, "metrics")} onKeepCart={() => navigate("cart")}
        onNavigate={nav} plannedHikes={plannedHikes} onPlanHike={onPlanHike} />}
  </Suspense>;
  return home;
}
