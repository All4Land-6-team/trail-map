import { Checkbox } from "../../../components/common/Checkbox";
import { CourseProfileChart } from "../../../components/chart/CourseProfileChart";
import { Icon } from "../../../components/common/Icon";
import { ReviewQuote } from "../../../components/content/ReviewQuote";
import { EmptyState } from "../../../components/feedback";
import type { CourseDetailData, ProfileVisibility } from "../../../types/courseDetail";
import type { CourseAnalysisState } from "../../../types/courseAnalysis";
import { detailAnalysisView, formatProfileValue } from "../../../utils/courseDetailAnalysis";
import { CourseAnalysisStatus } from "./CourseAnalysisStatus";

type Props = {
  data: CourseDetailData;
  analysisState: CourseAnalysisState;
  analysisView: ReturnType<typeof detailAnalysisView>;
  onRetryAnalysis: () => void;
  reviews: readonly { id: string; meta: string; quote: string }[];
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
  return <div className="course-analysis" role="tabpanel" id="course-analysis-panel" aria-label="코스 상세">
    <header className="course-analysis__intro">
      <h1>{course.name}</h1>
      <p>{formatProfileValue(metrics?.distanceMeters == null ? null : metrics.distanceMeters / 1000, "km", 2)}
        {" · 상승 "}{formatProfileValue(metrics?.elevationGainMeters, "m")}
        {" · 급경사 "}{formatProfileValue(metrics?.steepSectionRatioPercent, "%")}</p>
    </header>
    <CourseAnalysisStatus state={analysisState} development={development} onRetry={onRetryAnalysis} />
    <section className="course-analysis__profile" aria-label="코스 프로필">
      <div className="course-analysis__heading"><h2>코스 프로필</h2><span>최고 {formatProfileValue(metrics?.maxElevationMeters, "m")}</span></div>
      {sample ? <>
        <div className="course-profile-options">
          <Checkbox label="고도" showLabel checked={visibility.elevation} containerClassName="course-profile-options__elevation" onChange={() => onToggle("elevation")} />
          <Checkbox label="경사도" showLabel checked={visibility.slope} containerClassName="course-profile-options__slope" onChange={() => onToggle("slope")} />
        </div>
        <dl className="course-profile-readout" aria-label="그래프 선택 위치 값">
          <div><dt>거리</dt><dd>{formatProfileValue(sample.distanceKm, "km", 2)}</dd></div>
          {visibility.elevation && <div><dt>고도</dt><dd>{formatProfileValue(sample.elevationMeters, "m")}</dd></div>}
          {visibility.slope && <div className="course-profile-readout__slope"><dt>경사도</dt><dd>{formatProfileValue(sample.slopePercent, "%")}</dd></div>}
        </dl>
        <CourseProfileChart samples={samples} selectedIndex={selectedIndex} visibility={visibility} onSelect={onSelect} />
        {!samples.some(point => point.elevationMeters !== null || point.slopePercent !== null)
          && <p className="course-analysis-status">유효한 고도·경사 값이 없어 그래프 선을 표시하지 않아요.</p>}
      </> : <EmptyState title="표시할 분석 프로필이 없어요." description="분석 조회 상태를 확인해 주세요." showIcon={false} className="course-detail-empty" />}
    </section>
    <section className="course-analysis__reviews" aria-label="코스 후기">
      <div className="course-analysis__heading"><h2>코스 후기</h2>{reviewTotal > 0 && onReviewsOpen
        ? <button type="button" className="course-analysis__review-link" aria-label="코스 후기 전체보기" onClick={onReviewsOpen}>전체보기 <Icon name="ChevronRight" size={16} /></button>
        : <span>후기 {reviewTotal}</span>}</div>
      {reviews.length ? reviews.map(review => <ReviewQuote key={review.id} meta={review.meta} quote={review.quote} />)
        : <EmptyState title="아직 등록된 후기가 없어요." description="" showIcon={false} className="course-detail-empty" />}
    </section>
  </div>;
}
