import { useState } from "react";
import { Button } from "../../../components/common/Button";
import { Typography } from "../../../components/common/Typography";
import { BottomNavigation, TopBar, type BottomDestination } from "../../../components/layout";
import { formatAnalysisDistance, formatAnalysisDuration, type ComparisonCourseView } from "../../../utils/courseComparison";
import type { CourseComparisonState } from "../../../types/courseAnalysis";
import { ComparisonAnalysisStatus } from "./ComparisonAnalysisStatus";
import type { CartCourse } from "../types";
import { ScheduleRegistrationSheet } from "./ScheduleRegistrationSheet";
import type { PlannedHike } from "../../../types/hiking";

type ComparisonMetricsScreenProps = {
  courses: readonly CartCourse[];
  analysisCourses: readonly ComparisonCourseView[];
  analysisState: CourseComparisonState;
  onRetry: () => void;
  onBack: () => void;
  onCourseDetail: (courseId: string) => void;
  onKeepCart: () => void;
  onNavigate: (destination: BottomDestination) => void;
  plannedHikes: readonly PlannedHike[];
  onPlanHike: (plannedHike: PlannedHike) => void;
};

type Metric = {
  label: string;
  compact?: boolean;
  getValue: (course: ComparisonCourseView) => number | null;
  formatValue: (course: ComparisonCourseView) => string;
};

const metrics: readonly Metric[] = [
  {
    label: "거리 비교",
    getValue: (course) => course.analysis?.metrics.distanceMeters ?? null,
    formatValue: (course) => formatAnalysisDistance(course.analysis?.metrics.distanceMeters),
  },
  {
    label: "예상 시간 비교",
    getValue: (course) => course.analysis?.metrics.estimatedDurationSeconds ?? null,
    formatValue: (course) => formatAnalysisDuration(course.analysis?.metrics.estimatedDurationSeconds),
  },
  {
    label: "평균 경사 비교",
    compact: true,
    getValue: () => null,
    formatValue: () => "—",
  },
];

export function ComparisonMetricsScreen({
  courses,
  analysisCourses,
  analysisState,
  onRetry,
  onBack,
  onCourseDetail,
  onKeepCart,
  onNavigate,
  plannedHikes,
  onPlanHike,
}: ComparisonMetricsScreenProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const mountainName = analysisState.status === 'success' ? analysisState.data.mountainName : courses[0]?.mountain ?? '산';

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
          {analysisCourses.map((course, index) => (
            <div className="cart-metric-course-chip" key={course.id}>
              <span style={{ backgroundColor: course.color }}>{String.fromCharCode(65 + index)}</span>
              <Typography variant="controlLabel">{course.shortName}</Typography>
            </div>
          ))}
        </div>

        <Typography as="h2" variant="headingCard" className="cart-metrics-heading">코스별 비교</Typography>
        <div className="cart-metric-cards">
          {metrics.map((metric) => {
            const maxValue = Math.max(...analysisCourses.map((course) => metric.getValue(course) ?? 0), 1);
            return (
              <section className={["cart-metric-card", metric.compact && "cart-metric-card--compact"].filter(Boolean).join(" ")} key={metric.label}>
                <Typography as="h3" variant={metric.compact ? "dataAuxiliary" : "controlLabel"}>{metric.label}</Typography>
                {analysisCourses.map((course, index) => {
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
          미계산 값은 —로 표시해요. 평균 경사는 아직 제공하지 않아요.
        </Typography>
        <ComparisonAnalysisStatus state={analysisState} courses={analysisCourses} onRetry={onRetry} />
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
          courseSummaries={Object.fromEntries(analysisCourses.map(course => [course.id,
            `${formatAnalysisDistance(course.analysis?.metrics.distanceMeters)} · ${formatAnalysisDuration(course.analysis?.metrics.estimatedDurationSeconds)}`]))}
          selectCourseFirst
          existingSchedules={plannedHikes}
          onClose={() => setScheduleOpen(false)}
          onConfirm={(courseId, schedule) => {
            const course = courses.find((item) => item.id === courseId);
            if (!course) return;
            onPlanHike({
              ...schedule,
              courseId,
              mountain: course.mountain,
              courseName: course.name,
            });
          }}
        />
      )}
    </main>
  );
}
