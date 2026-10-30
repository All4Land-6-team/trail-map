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
import type { CourseComparisonState } from "../../../types/courseAnalysis";
import { analysisQualityLabel, type ComparisonCourseView } from "../../../utils/courseComparison";
import { ComparisonAnalysisStatus } from "./ComparisonAnalysisStatus";

type CourseCompareScreenProps = {
  courses: readonly CartCourse[];
  analysisCourses: readonly ComparisonCourseView[];
  analysisState: CourseComparisonState;
  onRetry: () => void;
  onBack: () => void;
  onViewMetrics: () => void;
  onNavigate: (destination: BottomDestination) => void;
};

export function CourseCompareScreen({
  courses,
  analysisCourses,
  analysisState,
  onRetry,
  onBack,
  onViewMetrics,
  onNavigate,
}: CourseCompareScreenProps) {
  const [dimension, setDimension] = useState<MapDimension>("2D");
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus>("idle");
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const resize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const mapRoutes = useMemo<MapRoute[]>(() => analysisCourses.filter(course => course.profile).map((course) => ({
    id: course.id,
    color: course.color,
    coordinates: course.profile!.samples.map(sample => sample.coordinate),
  })), [analysisCourses]);
  const chartSeries = useMemo<ElevationChartSeries[]>(() => analysisCourses.map((course) => ({
    id: course.id,
    name: course.name,
    color: course.color,
    points: course.profile?.samples.map(sample => ({ distanceKm: sample.distanceMeters / 1000, elevationMeters: sample.elevationMeters })) ?? [],
  })), [analysisCourses]);
  const sheet = useDraggableCartSheet({
    ariaLabel: "고도 그래프 높이 조절",
    openHeight: Math.min(326, Math.max(180, viewportHeight / 2)),
  });
  const terrainEnabled = supportsTerrain(courses[0]?.mountainId);
  useEffect(() => {
    if (!terrainEnabled) map?.easeTo({ pitch: dimension === "3D" ? 50 : 0, duration: 350 });
  }, [dimension, map, terrainEnabled]);
  useEffect(() => {
    if (!map || !mapRoutes.length) return;
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    for (const route of mapRoutes) for (const [lng, lat] of route.coordinates) {
      west = Math.min(west, lng); east = Math.max(east, lng); south = Math.min(south, lat); north = Math.max(north, lat);
    }
    map.fitBounds([[west, south], [east, north]], { padding: { top: 110, right: 45, bottom: Math.min(360, window.innerHeight * 0.45), left: 30 }, maxZoom: 14.5, duration: 0 });
  }, [map, mapRoutes]);
  const mountainName = analysisState.status === 'success' ? analysisState.data.mountainName : courses[0]?.mountain ?? '산';

  return (
    <main className="cart-screen cart-map-screen cart-compare-screen" style={sheet.sheetStyle}>
      <BaseMap
        ariaLabel={`${mountainName} 비교 코스 지도`}
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
        title={`${mountainName} · 코스 비교`}
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
        headerAction={<button type="button" className="cart-metrics-link" onClick={onViewMetrics}>비교표 ›</button>}
        content={(
          <div className="cart-compare-content">
            <div className="cart-course-legend" aria-label="코스 범례">
              {analysisCourses.map((course) => (
                <span key={course.id}>
                  <i style={{ backgroundColor: course.color }} />
                  <span className="cart-course-legend__copy">
                    <Typography variant="dataAuxiliary">{course.shortName}</Typography>
                    <Typography variant="dataAuxiliary">{analysisQualityLabel(course.analysis)}</Typography>
                  </span>
                </span>
              ))}
            </div>
            {analysisState.status !== 'success' && <ComparisonAnalysisStatus state={analysisState} courses={analysisCourses} onRetry={onRetry} />}
            <Typography as="h3" variant="controlLabel" className="cart-chart-title">고도 프로필</Typography>
            <CourseElevationChart series={chartSeries} />
            {analysisState.status === 'success' && <ComparisonAnalysisStatus state={analysisState} courses={analysisCourses} onRetry={onRetry} />}
          </div>
        )}
      />
      <BottomNavigation active="saved" onNavigate={onNavigate} className="cart-bottom-nav" />
    </main>
  );
}
