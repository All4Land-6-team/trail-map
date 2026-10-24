import { useEffect, useMemo, useState } from "react";
import type { MapLibreMap } from "maplibre-gl";
import { Button } from "../../../components/common/Button";
import { Icon } from "../../../components/common/Icon";
import { Typography } from "../../../components/common/Typography";
import { BottomNavigation, TopBar, type BottomDestination } from "../../../components/layout";
import { BaseMap, MapAction, supportsTerrain, type MapDimension, type MapRoute, type TerrainStatus } from "../../../components/map";
import { BottomSheet } from "../../../components/overlay";
import { BUKHANSAN_CENTER, formatCourseDuration, MAX_COMPARISON_COURSES } from "../data";
import type { CartCourse } from "../types";
import { useDraggableCartSheet } from "./useDraggableCartSheet";

type CourseSelectionScreenProps = {
  courses: readonly CartCourse[];
  selectedCourseIds: ReadonlySet<string>;
  onBack: () => void;
  onCompare: () => void;
  onCourseDetail: (courseId: string) => void;
  onNavigate: (destination: BottomDestination) => void;
  onToggleCourse: (courseId: string) => void;
};

export function CourseSelectionScreen({
  courses,
  selectedCourseIds,
  onBack,
  onCompare,
  onCourseDetail,
  onNavigate,
  onToggleCourse,
}: CourseSelectionScreenProps) {
  const [dimension, setDimension] = useState<MapDimension>("2D");
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus>("idle");
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const selectedCourses = useMemo(
    () => courses.filter((course) => selectedCourseIds.has(course.id)),
    [courses, selectedCourseIds],
  );
  const mapRoutes = useMemo<MapRoute[]>(() => selectedCourses.map((course) => ({
    id: course.id,
    color: course.color,
    coordinates: course.routeCoordinates,
  })), [selectedCourses]);
  const canCompare = selectedCourses.length >= 2;
  const selectionLimitReached = selectedCourses.length >= MAX_COMPARISON_COURSES;
  const selectionLimitMessage = `코스는 최대 ${MAX_COMPARISON_COURSES}개까지 선택할 수 있어요`;
  const terrainEnabled = supportsTerrain(courses[0]?.mountainId);
  useEffect(() => {
    if (!terrainEnabled) map?.easeTo({ pitch: dimension === "3D" ? 50 : 0, duration: 350 });
  }, [dimension, map, terrainEnabled]);
  const sheet = useDraggableCartSheet({
    ariaLabel: "코스 목록 높이 조절",
    openHeight: 360,
  });

  return (
    <main className="cart-screen cart-map-screen" style={sheet.sheetStyle}>
      <BaseMap
        ariaLabel={`${courses[0]?.mountain ?? "산"} 담은 코스 지도`}
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
        title={`${courses[0]?.mountain ?? "산"} · 담은 코스`}
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
        title={`담은 코스 ${courses.length}`}
        showClose={false}
        showDescription={false}
        showFooter
        className="cart-selection-sheet"
        bodyHidden={sheet.bodyHidden}
        handleProps={sheet.handleProps}
        content={(
          <div className="cart-course-list">
            <Typography variant="descriptionSmall" className="cart-selected-count">
              {selectedCourses.length}개 선택
            </Typography>
            {courses.map((course) => {
              const isSelected = selectedCourseIds.has(course.id);
              const selectionDisabled = !isSelected && selectionLimitReached;
              return (
                <div className="cart-course-row" key={course.id}>
                  <button
                    type="button"
                    className="cart-course-toggle"
                    aria-pressed={isSelected}
                    aria-label={`${course.name} ${isSelected ? "선택 해제" : selectionDisabled ? `선택 불가, 최대 ${MAX_COMPARISON_COURSES}개 선택됨` : "선택"}`}
                    disabled={selectionDisabled}
                    title={selectionDisabled ? selectionLimitMessage : undefined}
                    onClick={() => onToggleCourse(course.id)}
                  >
                    <span className="cart-course-check" style={{ backgroundColor: isSelected ? course.color : undefined }}>
                      {isSelected && <Icon name="Check" size={16} color="#fff" />}
                    </span>
                    <span className="cart-course-line" style={{ backgroundColor: course.color }} />
                    <span className="cart-course-copy">
                      <Typography variant="controlLabel">{course.name}</Typography>
                      <Typography variant="descriptionSmall">
                        {course.distanceKm} km · {formatCourseDuration(course.durationMinutes)}
                      </Typography>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="cart-course-detail"
                    aria-label={`${course.name} 상세 보기`}
                    onClick={() => onCourseDetail(course.id)}
                  >
                    <Icon name="ChevronRight" size={20} color="currentColor" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        footer={(
          <div className="cart-selection-footer">
            {selectionLimitReached ? (
              <Typography variant="descriptionSmall">{selectionLimitMessage}</Typography>
            ) : !canCompare && (
              <Typography variant="descriptionSmall">코스 2개 이상 선택</Typography>
            )}
            <Button fullWidth disabled={!canCompare} onClick={onCompare}>
              {canCompare ? `${selectedCourses.length}개 코스 비교` : "코스 비교"}
            </Button>
          </div>
        )}
      />
      <BottomNavigation active="saved" onNavigate={onNavigate} className="cart-bottom-nav" />
    </main>
  );
}
