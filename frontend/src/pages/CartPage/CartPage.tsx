import { lazy, Suspense, useState } from "react";
import type { BottomDestination } from "../../components/layout";
import { savedCourses } from "./data";
import { CartHomeScreen } from "./components/CartHomeScreen";
import { CourseSelectionScreen } from "./components/CourseSelectionScreen";
import "./cart.css";

const CourseCompareScreen = lazy(() => import("./components/CourseCompareScreen").then(
  ({ CourseCompareScreen: Screen }) => ({ default: Screen }),
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
