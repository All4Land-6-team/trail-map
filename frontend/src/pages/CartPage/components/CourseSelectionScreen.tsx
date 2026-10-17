import { useMemo } from "react";
import { Button } from "../../../components/common/Button";
import { Icon } from "../../../components/common/Icon";
import { Typography } from "../../../components/common/Typography";
import { BottomNavigation, TopBar, type BottomDestination } from "../../../components/layout";
import { BaseMap, MapAction, type MapRoute } from "../../../components/map";
import { BottomSheet } from "../../../components/overlay";
import { BUKHANSAN_CENTER, formatCourseDuration } from "../data";
import type { CartCourse } from "../types";
import { useDraggableCartSheet } from "./useDraggableCartSheet";

type CourseSelectionScreenProps = {
  courses: readonly CartCourse[];
  selectedCourseIds: ReadonlySet<string>;
  onBack: () => void;
  onCompare: () => void;
  onNavigate: (destination: BottomDestination) => void;
  onToggleCourse: (courseId: string) => void;
};

export function CourseSelectionScreen({
  courses,
  selectedCourseIds,
  onBack,
  onCompare,
  onNavigate,
  onToggleCourse,
}: CourseSelectionScreenProps) {
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
  const sheet = useDraggableCartSheet({
    ariaLabel: "코스 목록 높이 조절",
    openHeight: 360,
  });

  return (
    <main className="cart-screen cart-map-screen" style={sheet.sheetStyle}>
      <BaseMap
        ariaLabel="북한산 담은 코스 지도"
        center={BUKHANSAN_CENTER}
        zoom={12.8}
        routes={mapRoutes}
        showNavigationControl={false}
        className="cart-course-map"
      />
      <TopBar
        title="북한산 · 담은 코스"
        onBack={onBack}
        showAction={false}
        className="cart-map-topbar"
      />
      <div className="cart-map-actions" aria-label="지도 도구">
        <MapAction iconName="3D" defaultDimensionMode="3D" />
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
              return (
                <div className="cart-course-row" key={course.id}>
                  <button
                    type="button"
                    className="cart-course-toggle"
                    aria-pressed={isSelected}
                    aria-label={`${course.name} ${isSelected ? "선택 해제" : "선택"}`}
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
                  <span className="cart-course-detail" aria-hidden="true">
                    <Icon name="ChevronRight" size={20} color="currentColor" />
                  </span>
                </div>
              );
            })}
          </div>
        )}
        footer={(
          <div className="cart-selection-footer">
            {!canCompare && (
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
