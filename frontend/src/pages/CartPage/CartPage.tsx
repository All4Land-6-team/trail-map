import { lazy, Suspense, useState } from "react";
import type { BottomDestination } from "../../components/layout";
import { savedCourses } from "./data";
import { CartHomeScreen } from "./components/CartHomeScreen";
import { CourseSelectionScreen } from "./components/CourseSelectionScreen";
import "./cart.css";

const CourseCompareScreen = lazy(() => import("./components/CourseCompareScreen").then(
  ({ CourseCompareScreen: Screen }) => ({ default: Screen }),
));
const CourseDetailScreen = lazy(() => import("./components/CourseDetailScreen").then(
  ({ CourseDetailScreen: Screen }) => ({ default: Screen }),
));
const ComparisonMetricsScreen = lazy(() => import("./components/ComparisonMetricsScreen").then(
  ({ ComparisonMetricsScreen: Screen }) => ({ default: Screen }),
));

type CartPageProps = {
  route: string;
  onNavigateOutsideCart: (destination: BottomDestination) => void;
};

export function CartPage({ route, onNavigateOutsideCart }: CartPageProps) {
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(
    () => new Set(savedCourses.map((course) => course.id)),
  );
  const selectedCourses = savedCourses.filter((course) => selectedCourseIds.has(course.id));

  function navigate(path: string) {
    window.location.hash = path;
  }

  function handleBottomNavigation(destination: BottomDestination) {
    if (destination === "saved") {
      navigate("cart");
      return;
    }
    onNavigateOutsideCart(destination);
  }

  if (route === "#cart/bukhansan") {
    return (
      <CourseSelectionScreen
        courses={savedCourses}
        selectedCourseIds={selectedCourseIds}
        onBack={() => navigate("cart")}
        onCompare={() => navigate("cart/compare")}
        onCourseDetail={(courseId) => navigate(`cart/course/${courseId}`)}
        onNavigate={handleBottomNavigation}
        onToggleCourse={(courseId) => {
          setSelectedCourseIds((current) => {
            const next = new Set(current);
            if (next.has(courseId)) next.delete(courseId);
            else next.add(courseId);
            return next;
          });
        }}
      />
    );
  }

  if (route === "#cart/compare") {
    return (
      <Suspense fallback={<main className="app-route-loading" aria-busy="true">비교 화면을 불러오는 중이에요</main>}>
        <CourseCompareScreen
          courses={selectedCourses}
          onBack={() => navigate("cart/bukhansan")}
          onViewMetrics={() => navigate("cart/metrics")}
          onNavigate={handleBottomNavigation}
        />
      </Suspense>
    );
  }

  if (route === "#cart/metrics") {
    return (
      <Suspense fallback={<main className="app-route-loading" aria-busy="true">코스 비교표를 불러오는 중이에요</main>}>
        <ComparisonMetricsScreen
          courses={selectedCourses}
          onBack={() => navigate("cart/compare")}
          onCourseDetail={(courseId) => navigate(`cart/course/${courseId}?from=metrics`)}
          onKeepCart={() => navigate("cart")}
          onNavigate={handleBottomNavigation}
        />
      </Suspense>
    );
  }

  if (route.startsWith("#cart/course/")) {
    const [courseId, query = ""] = route.slice("#cart/course/".length).split("?");
    const detailOrigin = new URLSearchParams(query).get("from");
    const course = savedCourses.find((item) => item.id === courseId) ?? savedCourses[0];
    return (
      <Suspense fallback={<main className="app-route-loading" aria-busy="true">코스 상세를 불러오는 중이에요</main>}>
        <CourseDetailScreen
          course={course}
          onBack={() => navigate(detailOrigin === "metrics" ? "cart/metrics" : "cart/bukhansan")}
          onKeepCart={() => navigate("cart")}
          onNavigate={handleBottomNavigation}
        />
      </Suspense>
    );
  }

  return (
    <CartHomeScreen
      courses={route === "#cart/empty" ? [] : savedCourses}
      onBrowseMountains={() => onNavigateOutsideCart("home")}
      onNavigate={handleBottomNavigation}
      onSelectMountain={() => navigate("cart/bukhansan")}
    />
  );
}
