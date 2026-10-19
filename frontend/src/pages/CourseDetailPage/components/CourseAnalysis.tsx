import { Checkbox } from "../../../components/common/Checkbox";
import { CourseProfileChart } from "../../../components/chart/CourseProfileChart";
import { Icon } from "../../../components/common/Icon";
import { ReviewQuote } from "../../../components/content/ReviewQuote";
import { EmptyState } from "../../../components/feedback";
import type { CourseDetailData, ProfileVisibility } from "../../../types/courseDetail";

type Props = {
  data: CourseDetailData;
  reviews: readonly { id: string; meta: string; quote: string }[];
  reviewTotal: number;
  visibility: ProfileVisibility;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onToggle: (key: keyof ProfileVisibility) => void;
  onReviewsOpen?: () => void;
};
const metric = (value: number | null, unit: string) => value === null ? "분석 준비 중" : `${value} ${unit}`;

export function CourseAnalysis({ data, reviews, reviewTotal, visibility, selectedIndex, onSelect, onToggle, onReviewsOpen }: Props) {
  const { course, samples } = data;
  const sample = samples[selectedIndex];
  return <div className="course-analysis" role="tabpanel" id="course-analysis-panel" aria-label="코스 상세">
    <header className="course-analysis__intro">
      <h1>{course.name}</h1>
      <p>{course.distanceKm.toFixed(1)} km · 상승 {metric(course.elevationGainMeters, "m")} · 급경사 {metric(course.steepRatioPercent, "%")}</p>
    </header>
    <section className="course-analysis__profile" aria-label="코스 프로필">
      <div className="course-analysis__heading"><h2>코스 프로필</h2><span>최고 {metric(course.peakElevationMeters, "m")}</span></div>
      {sample ? <>
        <div className="course-profile-options">
          <Checkbox label="고도" showLabel checked={visibility.elevation} containerClassName="course-profile-options__elevation" onChange={() => onToggle("elevation")} />
          <Checkbox label="경사도" showLabel checked={visibility.slope} containerClassName="course-profile-options__slope" onChange={() => onToggle("slope")} />
        </div>
        <dl className="course-profile-readout" aria-label="그래프 선택 위치 값">
          <div><dt>거리</dt><dd>{sample.distanceKm.toFixed(1)} km</dd></div>
          {visibility.elevation && <div><dt>고도</dt><dd>약 {sample.elevationMeters} m</dd></div>}
          {visibility.slope && <div className="course-profile-readout__slope"><dt>경사도</dt><dd>약 {sample.slopePercent}%</dd></div>}
        </dl>
        <CourseProfileChart samples={samples} selectedIndex={selectedIndex} visibility={visibility} onSelect={onSelect} />
      </> : <EmptyState title="코스 분석을 준비하고 있어요." description="분석 데이터가 준비되면 고도와 경사도를 확인할 수 있어요." showIcon={false} className="course-detail-empty" />}
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
