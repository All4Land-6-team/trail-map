import { useMemo, useState } from "react";
import { Button } from "../../../components/common/Button";
import { Typography } from "../../../components/common/Typography";
import { BottomNavigation, TopBar, type BottomDestination } from "../../../components/layout";
import { BaseMap, type MapRoute } from "../../../components/map";
import { BottomSheet } from "../../../components/overlay";
import type { PlannedHike } from "../../../types/hiking";
import { formatCourseDuration } from "../data";
import type { CartCourse, ElevationChartSeries } from "../types";
import { CourseElevationChart } from "./CourseElevationChart";
import { ScheduleRegistrationSheet } from "./ScheduleRegistrationSheet";
import { useDraggableCartSheet } from "./useDraggableCartSheet";

type CourseDetailScreenProps = {
  course: CartCourse;
  onBack: () => void;
  onKeepCart: () => void;
  onNavigate: (destination: BottomDestination) => void;
  plannedHikes: readonly PlannedHike[];
  onPlanHike: (plannedHike: PlannedHike) => void;
};

const DETAIL_MAP_PADDING = { top: 118, right: 36, bottom: 430, left: 36 };

export function CourseDetailScreen({
  course,
  onBack,
  onKeepCart,
  onNavigate,
  plannedHikes,
  onPlanHike,
}: CourseDetailScreenProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const mapRoutes = useMemo<MapRoute[]>(() => [{
    id: course.id,
    color: course.color,
    coordinates: course.routeCoordinates,
    showEndpoint: true,
  }], [course]);
  const courseBounds = useMemo<[[number, number], [number, number]]>(() => {
    const longitudes = course.routeCoordinates.map(([longitude]) => longitude);
    const latitudes = course.routeCoordinates.map(([, latitude]) => latitude);
    return [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ];
  }, [course]);
  const chartSeries = useMemo<ElevationChartSeries[]>(() => [{
    id: course.id,
    name: course.name,
    color: course.color,
    points: course.elevationProfile,
  }], [course]);
  const sheet = useDraggableCartSheet({
    ariaLabel: "코스 상세 높이 조절",
    openHeight: 391,
  });

  return (
    <main className="cart-screen cart-map-screen cart-detail-screen" style={sheet.sheetStyle}>
      <BaseMap
        ariaLabel={`${course.name} 지도`}
        bounds={courseBounds}
        fitBoundsPadding={DETAIL_MAP_PADDING}
        routes={mapRoutes}
        showNavigationControl={false}
        className="cart-course-map"
      />
      <TopBar
        title={`${course.shortName} 코스 상세`}
        onBack={onBack}
        showAction={false}
        className="cart-map-topbar"
      />

      <BottomSheet
        title={course.name}
        description={course.mountain}
        showClose={false}
        className="cart-detail-sheet"
        bodyHidden={sheet.bodyHidden}
        handleProps={sheet.handleProps}
        content={(
          <div className="cart-detail-content">
            <div className="cart-detail-stats">
              <div><Typography variant="descriptionSmall">거리</Typography><Typography variant="controlLabel">{course.distanceKm} km</Typography></div>
              <div><Typography variant="descriptionSmall">예상 시간</Typography><Typography variant="controlLabel">{formatCourseDuration(course.durationMinutes)}</Typography></div>
              <div><Typography variant="descriptionSmall">평균 경사</Typography><Typography variant="controlLabel">{course.averageSlopePercent == null ? "—" : `${course.averageSlopePercent}%`}</Typography></div>
            </div>
            <Typography as="h3" variant="controlLabel" className="cart-detail-chart-title">고도 프로필</Typography>
            <CourseElevationChart
              series={chartSeries}
              ariaLabel={`${course.name} 고도 프로필`}
              ariaDescription={`${course.name}의 거리별 고도를 나타낸 선 그래프`}
            />
            <div className="cart-detail-actions">
              <Button variant="secondary" fullWidth onClick={onKeepCart}>담기 유지</Button>
              <Button fullWidth onClick={() => setScheduleOpen(true)}>일정 등록</Button>
            </div>
          </div>
        )}
      />
      <BottomNavigation active="saved" onNavigate={onNavigate} className="cart-bottom-nav" />

      {scheduleOpen && (
        <ScheduleRegistrationSheet
          courses={[course]}
          initialCourseId={course.id}
          existingSchedules={plannedHikes}
          onClose={() => setScheduleOpen(false)}
          onConfirm={(_, schedule) => {
            onPlanHike({
              ...schedule,
              courseId: course.id,
              mountain: course.mountain,
              courseName: course.name,
            });
          }}
        />
      )}
    </main>
  );
}
