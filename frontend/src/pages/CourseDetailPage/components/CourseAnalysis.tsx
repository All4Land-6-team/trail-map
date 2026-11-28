import { useMemo, useState } from "react";
import { Checkbox } from "../../../components/common/Checkbox";
import { CourseProfileChart } from "../../../components/chart/CourseProfileChart";
import { ReviewCarousel } from "../../../components/review/ReviewCarousel";
import { EmptyState } from "../../../components/feedback";
import type { CourseDetailData, ProfileVisibility } from "../../../types/courseDetail";
import type { CourseAnalysisState } from "../../../types/courseAnalysis";
import type { CommunityReview } from "../../../types/community";
import { detailAnalysisView, formatProfileValue, profileSlopeDirection, profileSlopeSectionAt, summarizeProfileSlope, topSteepProfileSections } from "../../../utils/courseDetailAnalysis";
import { CourseAnalysisStatus } from "./CourseAnalysisStatus";
import { CourseBasicInfo } from "./CourseBasicInfo";
import { steepRatioGrade, steepSlopeThreshold } from "../../../utils/courseComparison";

type Props = {
  data: CourseDetailData;
  analysisState: CourseAnalysisState;
  analysisView: ReturnType<typeof detailAnalysisView>;
  onRetryAnalysis: () => void;
  reviews: readonly CommunityReview[];
  reviewTotal: number;
  visibility: ProfileVisibility;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onToggle: (key: keyof ProfileVisibility) => void;
  onReviewsOpen?: () => void;
};
export function CourseAnalysis({ data, analysisState, analysisView, onRetryAnalysis, reviews, reviewTotal,
  visibility, selectedIndex, onSelect, onToggle, onReviewsOpen }: Props) {
  const { course } = data;
  const { analysis, samples, development } = analysisView;
  const metrics = analysis?.metrics;
  const sample = samples[selectedIndex];
  const [slopeMode, setSlopeMode] = useState<'summary' | 'raw'>('summary');
  const slopeSections = useMemo(() => summarizeProfileSlope(samples), [samples]);
  const selectedSection = sample ? profileSlopeSectionAt(slopeSections, sample.distanceKm) : null;
  const threshold = steepSlopeThreshold(analysis);
  const highlightedSections = useMemo(() => topSteepProfileSections(slopeSections, threshold), [slopeSections, threshold]);
  return <div className="course-analysis" role="tabpanel" id="course-analysis-panel" aria-label="코스 상세">
    <header className="course-analysis__intro">
      <h1>{course.name}</h1>
      <p>{!course.routeSource && <>{formatProfileValue(metrics?.distanceMeters == null ? null : metrics.distanceMeters / 1000, "km", 2)}{" · "}</>}
        {"상승 "}{formatProfileValue(metrics?.elevationGainMeters, "m")}
        {" · 급경사 비중 "}{steepRatioGrade(metrics?.steepSectionRatioPercent)}</p>
    </header>
    {course.routeSource && <CourseBasicInfo course={course} />}
    <CourseAnalysisStatus state={analysisState} development={development} onRetry={onRetryAnalysis} />
    <section className="course-analysis__profile" aria-label="코스 프로필">
      <div className="course-analysis__heading"><h2>코스 프로필</h2><span>최고 {formatProfileValue(metrics?.maxElevationMeters, "m")}</span></div>
      {sample ? <>
        {visibility.elevation && highlightedSections.length > 0 && <p className="course-profile-highlights">
          <span aria-hidden="true" />50m 평균 기준 급경사 상위 {highlightedSections.length}개 구간
        </p>}
        <div className="course-profile-options">
          <Checkbox label="고도" showLabel checked={visibility.elevation} containerClassName="course-profile-options__elevation" onChange={() => onToggle("elevation")} />
          <Checkbox label="경사도" showLabel checked={visibility.slope} containerClassName="course-profile-options__slope" onChange={() => onToggle("slope")} />
        </div>
        <dl className="course-profile-readout" aria-label="그래프 선택 위치 값">
          <div><dt>거리</dt><dd>{formatProfileValue(sample.distanceKm, "km", 2)}</dd></div>
          {visibility.elevation && <div><dt>고도</dt><dd>{formatProfileValue(sample.elevationMeters, "m")}</dd></div>}
          {visibility.slope && <div className="course-profile-readout__slope"><dt>선택 위치 원본 경사</dt><dd>{formatProfileValue(sample.slopePercent, "%")}</dd></div>}
        </dl>
        {visibility.slope && <>
          <div className="course-profile-slope-controls" role="group" aria-label="경사 표시 방식">
            <span>경사 표시</span>
            <button type="button" aria-pressed={slopeMode === 'summary'} onClick={() => setSlopeMode('summary')}>50m 평균</button>
            <button type="button" aria-pressed={slopeMode === 'raw'} onClick={() => setSlopeMode('raw')}>원본</button>
          </div>
          <p className="course-profile-selection" aria-live="polite" aria-atomic="true">
            {slopeMode === 'summary' ? selectedSection
              ? <>{formatProfileValue(selectedSection.startKm, 'km', 2)}–{formatProfileValue(selectedSection.endKm, 'km', 2)} 평균 {formatProfileValue(selectedSection.slopePercent, '%')} · {profileSlopeDirection(selectedSection.slopePercent)}</>
              : '이 위치는 평균 경사 정보가 없어요.'
              : <>선택 위치 원본 · {profileSlopeDirection(sample.slopePercent)}</>}
          </p>
        </>}
        <CourseProfileChart samples={samples} selectedIndex={selectedIndex} visibility={visibility} onSelect={onSelect}
          slopeMode={slopeMode} slopeSections={slopeSections} steepThreshold={threshold} highlightedSections={highlightedSections} />
        {visibility.slope && <div className="course-profile-guide">
          <p className="course-profile-legend"><span className="course-profile-legend__up">+ 오르막</span><span className="course-profile-legend__down">− 내리막</span><span>0% 평지</span></p>
          <details><summary>경사 그래프 읽는 법</summary>
          <p>경사 20%는 수평으로 100m 갈 때 높이가 20m 변하는 기울기예요. 각도 20°와 달라요.</p>
          {threshold !== null && <p>점선 ±{threshold.toLocaleString('ko-KR', { maximumSignificantDigits: 6 })}%는 이 분석의 급경사 기준이에요.</p>}
          <p>{slopeMode === 'summary' ? '50m 평균은 구간 길이로 가중한 경사예요. 결측 앞뒤는 합치지 않으며 마지막·결측 주변 구간은 50m보다 짧을 수 있어요. 짧은 급경사는 원본으로 확인해 주세요.' : '원본은 선택 위치 직전 구간의 경사예요. 짧은 거리의 고도 차이로 값이 크게 변할 수 있어요.'}</p>
          <p>코스 진행 방향 기준이에요. 빈 구간은 정보 없음이며, 경사만으로 전체 난이도를 판단할 수 없어요.</p>
          </details>
        </div>}
        {!samples.some(point => point.elevationMeters !== null || point.slopePercent !== null)
          && <p className="course-analysis-status">유효한 고도·경사 값이 없어 그래프 선을 표시하지 않아요.</p>}
      </> : <EmptyState title="표시할 분석 프로필이 없어요." description="분석 조회 상태를 확인해 주세요." showIcon={false} className="course-detail-empty" />}
    </section>
    <section className="course-analysis__reviews" aria-label="코스 후기">
      <div className="course-analysis__heading"><h2>코스 후기</h2><span>후기 {reviewTotal}</span></div>
      <ReviewCarousel type="course" reviews={reviews} onReviewClick={() => onReviewsOpen?.()} onViewAll={() => onReviewsOpen?.()} />
    </section>
  </div>;
}
