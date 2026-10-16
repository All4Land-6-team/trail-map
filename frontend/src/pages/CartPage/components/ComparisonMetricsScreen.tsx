import { useState } from "react";
import { Button } from "../../../components/common/Button";
import { Typography } from "../../../components/common/Typography";
import { BottomNavigation, TopBar, type BottomDestination } from "../../../components/layout";
import { formatCourseDuration } from "../data";
import type { CartCourse } from "../types";
import { ScheduleRegistrationSheet } from "./ScheduleRegistrationSheet";

type ComparisonMetricsScreenProps = {
  courses: readonly CartCourse[];
  onBack: () => void;
  onCourseDetail: (courseId: string) => void;
  onKeepCart: () => void;
  onNavigate: (destination: BottomDestination) => void;
};

type Metric = {
  label: string;
  compact?: boolean;
  getValue: (course: CartCourse) => number | undefined;
  formatValue: (course: CartCourse) => string;
};

const metrics: readonly Metric[] = [
  {
    label: "거리 비교",
    getValue: (course) => course.distanceKm,
    formatValue: (course) => `${course.distanceKm} km`,
  },
  {
    label: "예상 시간 비교",
    getValue: (course) => course.durationMinutes,
    formatValue: (course) => formatCourseDuration(course.durationMinutes),
  },
  {
    label: "평균 경사 비교",
    compact: true,
    getValue: (course) => course.averageSlopePercent,
    formatValue: (course) => course.averageSlopePercent == null ? "—" : `${course.averageSlopePercent}%`,
  },
];

export function ComparisonMetricsScreen({
  courses,
  onBack,
  onCourseDetail,
  onKeepCart,
  onNavigate,
}: ComparisonMetricsScreenProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const mountainName = courses[0]?.mountain ?? "산";

  return (
    <main className="cart-screen cart-metrics-screen">
      <TopBar
        title={`${mountainName} · 코스 비교표`}
        onBack={onBack}
        showAction={false}
        className="cart-metrics-topbar"
      />

      <div className="cart-metrics-scroll">
        <Typography variant="descriptionSmall" className="cart-metrics-eyebrow">
          {mountainName} · 선택한 {courses.length}개 코스
        </Typography>
        <div className="cart-metric-course-chips" aria-label="비교 코스">
          {courses.map((course, index) => (
            <div className="cart-metric-course-chip" key={course.id}>
              <span style={{ backgroundColor: course.color }}>{String.fromCharCode(65 + index)}</span>
              <Typography variant="controlLabel">{course.shortName}</Typography>
            </div>
          ))}
        </div>

        <Typography as="h2" variant="headingCard" className="cart-metrics-heading">코스별 비교</Typography>
        <div className="cart-metric-cards">
          {metrics.map((metric) => {
            const maxValue = Math.max(...courses.map((course) => metric.getValue(course) ?? 0), 1);
            return (
              <section className={["cart-metric-card", metric.compact && "cart-metric-card--compact"].filter(Boolean).join(" ")} key={metric.label}>
                <Typography as="h3" variant={metric.compact ? "dataAuxiliary" : "controlLabel"}>{metric.label}</Typography>
                {courses.map((course, index) => {
                  const value = metric.getValue(course);
                  const rowVariant = metric.compact ? "dataAuxiliary" : "descriptionSmall";
                  return (
                    <div className="cart-metric-row" key={course.id}>
                      <Typography variant={metric.compact ? "dataAuxiliary" : "badgeLabel"} style={{ color: course.color }}>
                        {String.fromCharCode(65 + index)}
                      </Typography>
                      <Typography variant={rowVariant}>{course.shortName}</Typography>
                      <span className="cart-metric-track" aria-hidden="true">
                        {value != null && <span style={{ width: `${(value / maxValue) * 100}%`, backgroundColor: course.color }} />}
                      </span>
                      <Typography variant="badgeLabel" className="cart-metric-value">
                        {metric.formatValue(course)}
                      </Typography>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
        <Typography variant="descriptionSmall" className="cart-metrics-note">
          코스 수치와 지도 경로는 화면 구성용 예시입니다.
        </Typography>
        <div className="cart-course-detail-links">
          {courses.map((course) => (
            <button type="button" key={course.id} onClick={() => onCourseDetail(course.id)}>
              {course.shortName} 상세 ›
            </button>
          ))}
        </div>
      </div>

      <section className="cart-metrics-actions" aria-label="코스 비교 작업">
        <Typography variant="descriptionSmall">이 코스들 중 하나를 일정으로 등록할까요?</Typography>
        <div>
          <Button variant="secondary" fullWidth onClick={onKeepCart}>담기 유지</Button>
          <Button fullWidth onClick={() => setScheduleOpen(true)}>일정 등록</Button>
        </div>
      </section>
      <BottomNavigation active="saved" onNavigate={onNavigate} className="cart-bottom-nav" />

      {scheduleOpen && (
        <ScheduleRegistrationSheet
          courses={courses}
          selectCourseFirst
          onClose={() => setScheduleOpen(false)}
          onConfirm={() => onNavigate("myHikes")}
        />
      )}
    </main>
  );
}
