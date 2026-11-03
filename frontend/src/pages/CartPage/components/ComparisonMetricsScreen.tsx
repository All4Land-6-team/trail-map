import { useState } from "react";
import { Button } from "../../../components/common/Button";
import { Typography } from "../../../components/common/Typography";
import { BottomNavigation, TopBar, type BottomDestination } from "../../../components/layout";
import { analysisSteepNotice, formatAnalysisDistance, formatAnalysisDuration, formatSteepRatio,
  steepSlopeThreshold, type ComparisonCourseView } from "../../../utils/courseComparison";
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
    label: "급경사 비율 비교",
    getValue: (course) => course.analysis?.metrics.steepSectionRatioPercent ?? null,
    formatValue: (course) => formatSteepRatio(course.analysis?.metrics.steepSectionRatioPercent),
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
  const schedulableCourses = courses.filter(course => course.scheduleAvailable !== false);
  const mountainName = analysisState.status === 'success' ? analysisState.data.mountainName : courses[0]?.mountain ?? '산';
  const steepThresholds = new Set(analysisCourses.filter(course => course.analysis?.metrics.steepSectionRatioPercent != null)
    .map(course => steepSlopeThreshold(course.analysis)));
  const differentSteepPolicies = steepThresholds.has(null) || steepThresholds.size > 1;
  const steepNotices = [...new Set(analysisCourses.map(course => analysisSteepNotice(course.analysis)).filter(value => value !== null))];

  return (
    <main className="cart-screen cart-metrics-screen">
      <TopBar
        title={`${mountainName} · 코스 비교표`}
        onBack={onBack}
        showAction={false}
        className="cart-metrics-topbar"
      />

      <div className="cart-metrics-scroll" role="region" aria-label="코스 비교 내용" tabIndex={0}>
        <Typography variant="bodySmall" className="cart-metrics-eyebrow">
          {mountainName} · 선택한 {courses.length}개 코스
        </Typography>
        <ul className="cart-metric-course-chips" aria-label="비교 코스">
          {analysisCourses.map((course, index) => (
            <li className="cart-metric-course-chip" key={course.id}>
              <span style={{ backgroundColor: course.color }} aria-hidden="true">{String.fromCharCode(65 + index)}</span>
              <Typography variant="controlLabel" title={course.name}>{course.shortName}</Typography>
            </li>
          ))}
        </ul>

        <Typography as="h2" variant="headingCard" className="cart-metrics-heading">코스별 비교</Typography>
        <div className="cart-metric-cards">
          {metrics.map((metric) => {
            const maxValue = Math.max(...analysisCourses.map((course) => metric.getValue(course) ?? 0), 1);
            return (
              <section className="cart-metric-card" key={metric.label} aria-label={metric.label}>
                <Typography as="h3" variant="buttonLabel">{metric.label}</Typography>
                <ul className="cart-metric-rows">
                  {analysisCourses.map((course, index) => {
                    const value = metric.getValue(course);
                    return (
                      <li className="cart-metric-row" key={course.id}>
                        <span className="cart-metric-identity">
                          <Typography variant="controlLabel" className="cart-metric-key" style={{ backgroundColor: course.color }} aria-hidden="true">
                            {String.fromCharCode(65 + index)}
                          </Typography>
                          <Typography variant="bodyMedium" className="cart-metric-course-name" title={course.name}>{course.shortName}</Typography>
                        </span>
                        <Typography variant="buttonLabel" className="cart-metric-value">
                          {metric.formatValue(course)}
                        </Typography>
                        {value != null && !(metric.label === "급경사 비율 비교" && differentSteepPolicies)
                          && <span className="cart-metric-track" aria-hidden="true">
                          <span style={{ width: `${(value / maxValue) * 100}%`, backgroundColor: course.color }} />
                        </span>}
                      </li>
                    );
                  })}
                </ul>
                {metric.label === "급경사 비율 비교" && <>
                  {differentSteepPolicies && <Typography as="p" variant="bodySmall" className="cart-metrics-note">
                    급경사 기준이 다르거나 확인되지 않은 코스가 있어 직접 비교하기 어려워요. 분석 상태에서 각 기준을 확인해 주세요.
                  </Typography>}
                  {steepNotices.length === 1 && <Typography as="p" variant="bodySmall" className="cart-metrics-note">{steepNotices[0]}</Typography>}
                </>}
              </section>
            );
          })}
        </div>
        <Typography as="p" variant="bodySmall" className="cart-metrics-note">
          미계산 값은 —로 표시해요.
        </Typography>
        <ComparisonAnalysisStatus state={analysisState} courses={analysisCourses} onRetry={onRetry} />
        <nav className="cart-course-detail-links" aria-label="선택한 코스 상세">
          {courses.map((course) => (
            <button type="button" key={course.id} onClick={() => onCourseDetail(course.id)} aria-label={`${course.name} 상세 보기`}>
              <Typography variant="bodyMedium">{course.shortName}</Typography>
              <Typography variant="controlLabel">상세 보기 <span aria-hidden="true">›</span></Typography>
            </button>
          ))}
        </nav>
      </div>

      <section className="cart-metrics-actions" aria-label="코스 비교 작업">
        <Typography as="p" variant="bodySmall">이 코스들 중 하나를 일정으로 등록할까요?</Typography>
        <div>
          <Button variant="secondary" fullWidth onClick={onKeepCart}>담기 유지</Button>
          <Button fullWidth disabled={!schedulableCourses.length} onClick={() => setScheduleOpen(true)}>
            {schedulableCourses.length ? "일정 등록" : "일정 연동 예정"}
          </Button>
        </div>
      </section>
      <BottomNavigation active="saved" onNavigate={onNavigate} className="cart-bottom-nav" />

      {scheduleOpen && schedulableCourses.length > 0 && (
        <ScheduleRegistrationSheet
          courses={schedulableCourses}
          courseSummaries={Object.fromEntries(analysisCourses.map(course => [course.id,
            `${formatAnalysisDistance(course.analysis?.metrics.distanceMeters)} · ${formatAnalysisDuration(course.analysis?.metrics.estimatedDurationSeconds)}`]))}
          selectCourseFirst
          existingSchedules={plannedHikes}
          onClose={() => setScheduleOpen(false)}
          onConfirm={(courseId, schedule) => {
            const course = schedulableCourses.find((item) => item.id === courseId);
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
