import { useEffect, useMemo, useState } from "react";
import type { MapLibreMap } from "maplibre-gl";
import { Typography } from "../../../components/common/Typography";
import { BottomNavigation, TopBar, type BottomDestination } from "../../../components/layout";
import { BaseMap, MapAction, supportsTerrain, type MapDimension, type MapRoute, type TerrainStatus } from "../../../components/map";
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
  const [dimension, setDimension] = useState<MapDimension>("2D");
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus>("idle");
  const [map, setMap] = useState<MapLibreMap | null>(null);
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
  const terrainEnabled = supportsTerrain(courses[0]?.mountainId);
  useEffect(() => {
    if (!terrainEnabled) map?.easeTo({ pitch: dimension === "3D" ? 50 : 0, duration: 350 });
  }, [dimension, map, terrainEnabled]);

  return (
    <main className="cart-screen cart-map-screen cart-compare-screen" style={sheet.sheetStyle}>
      <BaseMap
        ariaLabel={`${courses[0]?.mountain ?? "산"} 비교 코스 지도`}
        center={courses[0]?.routeCoordinates[0] ?? BUKHANSAN_CENTER}
        zoom={12.8}
        routes={mapRoutes}
        showNavigationControl={false}
        className="cart-course-map"
        onMapReady={setMap}
        terrainMode={terrainEnabled ? dimension : undefined}
        onTerrainStatusChange={setTerrainStatus}
      />
      <TopBar
        title={`${courses[0]?.mountain ?? "산"} · 코스 비교`}
        onBack={onBack}
        showAction={false}
        className="cart-map-topbar"
      />
      <div className="cart-map-actions" aria-label="지도 도구">
        <MapAction dimensionMode={dimension === "2D" ? "3D" : "2D"}
          aria-label={`${dimension === "2D" ? "3D" : "2D"} 지도 보기`}
          aria-busy={terrainEnabled && terrainStatus === "loading"}
          disabled={terrainEnabled && terrainStatus !== "ready"}
          onDimensionModeChange={() => setDimension(current => current === "2D" ? "3D" : "2D")} />
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
