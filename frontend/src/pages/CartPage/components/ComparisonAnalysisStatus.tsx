import type { CourseComparisonState } from '../../../types/courseAnalysis';
import { analysisQualityLabel, analysisQualityReasons, type ComparisonCourseView } from '../../../utils/courseComparison';

export function ComparisonAnalysisStatus({ state, courses, onRetry }: {
  state: CourseComparisonState; courses: readonly ComparisonCourseView[]; onRetry: () => void;
}) {
  if (state.status === 'loading') return <p className="cart-analysis-message" role="status">코스 분석을 불러오는 중이에요.</p>;
  if (state.status !== 'success') return <div className="cart-analysis-message" role={state.status === 'error' ? 'alert' : 'status'}>
    <p>{state.message}</p>
    {state.status === 'error' && <button type="button" onClick={onRetry}>다시 불러오기</button>}
  </div>;
  return <div className="cart-analysis-status">
    {courses.some(course => course.development) && <p className="cart-analysis-origin">개발용 예시 경로예요. 실제 등산로 정보가 아니에요.</p>}
    {courses.some(course => course.profileError) && <p role="alert" className="cart-analysis-message">일부 고도 프로필을 불러오지 못했어요. <button type="button" onClick={onRetry}>다시 불러오기</button></p>}
    <details className="cart-analysis-details">
    <summary>{courses.map(course => `${course.shortName} · ${analysisQualityLabel(course.analysis)}`).join(' / ')}</summary>
    {courses.some(course => course.development) && <p>개발용 예시 경로의 분석 결과예요. 실제 등산로 정보가 아니에요.</p>}
    {courses.map(course => <section key={course.id} aria-label={`${course.name} 분석 상태`}>
      <strong>{course.name} · {analysisQualityLabel(course.analysis)}</strong>
      {course.analysis && <>
        <p>현재 코스 v{course.analysis.currentCourseVersion}{course.analysis.analyzedCourseVersion !== null
          ? ` · 분석 코스 v${course.analysis.analyzedCourseVersion}` : ''}</p>
        {analysisQualityReasons(course.analysis).map(message => <p key={message}>{message}</p>)}
        {course.analysis.coverage && <p>고도 확인 범위 {course.analysis.coverage.sampleCoveragePercent.toFixed(1)}%</p>}
        {course.analysis.settings && <p>샘플 간격 {course.analysis.settings.sampleIntervalMeters} m · {course.analysis.settings.elevationProcessing === 'unsmoothed' ? '고도 평활화 미적용' : '고도 보정 적용'}</p>}
        {course.analysis.calculatedAt && <p>분석 시각 {new Date(course.analysis.calculatedAt).toLocaleString('ko-KR')}</p>}
      </>}
      {course.profileError && <p role="alert">프로필: {course.profileError}</p>}
    </section>)}
    <button type="button" onClick={onRetry}>다시 불러오기</button>
  </details></div>;
}
