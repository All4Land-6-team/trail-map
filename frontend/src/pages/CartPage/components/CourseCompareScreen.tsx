import { useMemo } from "react";
import { Typography } from "../../../components/common/Typography";
import { BottomNavigation, TopBar, type BottomDestination } from "../../../components/layout";
import { BaseMap, MapAction, type MapRoute } from "../../../components/map";
import { BottomSheet } from "../../../components/overlay";
import { BUKHANSAN_CENTER } from "../data";
import type { CartCourse, ElevationChartSeries } from "../types";
import { CourseElevationChart } from "./CourseElevationChart";
import { useDraggableCartSheet } from "./useDraggableCartSheet";

type CourseCompareScreenProps = {
  courses: readonly CartCourse[];
  onBack: () => void;
  onViewMetrics: () => void;
  onNavigate: (destination: BottomDestination) => void;
};

export function CourseCompareScreen({
  courses,
  onBack,
  onViewMetrics,
  onNavigate,
}: CourseCompareScreenProps) {
  const mapRoutes = useMemo<MapRoute[]>(() => courses.map((course) => ({
    id: course.id,
    color: course.color,
    coordinates: course.routeCoordinates,
  })), [courses]);
  const chartSeries = useMemo<ElevationChartSeries[]>(() => courses.map((course) => ({
    id: course.id,
    name: course.name,
    color: course.color,
    points: course.elevationProfile,
  })), [courses]);
  const sheet = useDraggableCartSheet({
    ariaLabel: "고도 그래프 높이 조절",
    openHeight: 326,
  });

  return (
    <main className="cart-screen cart-map-screen cart-compare-screen" style={sheet.sheetStyle}>
      <BaseMap
        ariaLabel={`${courses[0]?.mountain ?? "산"} 비교 코스 지도`}
        center={courses[0]?.routeCoordinates[0] ?? BUKHANSAN_CENTER}
        zoom={12.8}
        routes={mapRoutes}
        showNavigationControl={false}
        className="cart-course-map"
      />
      <TopBar
        title={`${courses[0]?.mountain ?? "산"} · 코스 비교`}
        onBack={onBack}
        showAction={false}
        className="cart-map-topbar"
      />
      <div className="cart-map-actions" aria-label="지도 도구">
        <MapAction iconName="3D" defaultDimensionMode="3D" />
        <MapAction iconName="Locate" />
      </div>

      <BottomSheet
        title={`코스 ${courses.length}개 비교`}
        showClose={false}
        showDescription={false}
        className="cart-compare-sheet"
        bodyHidden={sheet.bodyHidden}
        handleProps={sheet.handleProps}
        content={(
          <div className="cart-compare-content">
            <button type="button" className="cart-metrics-link" onClick={onViewMetrics}>
              비교표 ›
            </button>
            <div className="cart-course-legend" aria-label="코스 범례">
              {courses.map((course) => (
                <span key={course.id}>
                  <i style={{ backgroundColor: course.color }} />
                  <Typography variant="dataAuxiliary">{course.shortName}</Typography>
                </span>
              ))}
            </div>
            <Typography as="h3" variant="controlLabel" className="cart-chart-title">고도 프로필</Typography>
            <CourseElevationChart series={chartSeries} />
          </div>
        )}
      />
      <BottomNavigation active="saved" onNavigate={onNavigate} className="cart-bottom-nav" />
    </main>
  );
}
