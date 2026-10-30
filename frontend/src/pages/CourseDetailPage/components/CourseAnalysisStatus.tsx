import type { CourseAnalysisState } from '../../../types/courseAnalysis';
import { analysisQualityLabel, analysisQualityReasons } from '../../../utils/courseComparison';

export function CourseAnalysisStatus({ state, development, onRetry }: {
  state: CourseAnalysisState; development: boolean; onRetry: () => void;
}) {
  if (state.status === 'loading') return <p className="course-analysis-status" role="status">코스 분석을 불러오는 중이에요.</p>;
  if (state.status !== 'success') return <div className="course-analysis-status" role={state.status === 'error' ? 'alert' : 'status'}>
    <p>{state.message}</p>
    {state.status === 'error' && <button type="button" onClick={onRetry}>분석 다시 불러오기</button>}
  </div>;
  const { analysis, profileError } = state.data;
  return <div className="course-analysis-status" data-analysis-id={analysis.analysisId ?? ''}>
    {development && <p className="course-analysis-origin">개발용 예시 경로의 분석 결과예요. 실제 등산로 정보가 아니에요.</p>}
    {profileError && <p role="alert">고도·경사 프로필을 불러오지 못했어요. <button type="button" onClick={onRetry}>분석 다시 불러오기</button></p>}
    <details>
      <summary>분석 상태 · {analysisQualityLabel(analysis)}</summary>
      {analysisQualityReasons(analysis).map(message => <p key={message}>{message}</p>)}
      <p>현재 코스 v{analysis.currentCourseVersion}{analysis.analyzedCourseVersion !== null
        ? ' · 분석 코스 v' + analysis.analyzedCourseVersion : ''}</p>
      {analysis.coverage && <p>고도 확인 범위 {analysis.coverage.sampleCoveragePercent.toFixed(1)}%</p>}
      {analysis.settings && <p>샘플 간격 {analysis.settings.sampleIntervalMeters} m · {analysis.settings.elevationProcessing === 'unsmoothed' ? '고도 평활화 미적용' : '고도 보정 적용'}</p>}
      {analysis.calculatedAt && <p>분석 시각 {new Date(analysis.calculatedAt).toLocaleString('ko-KR')}</p>}
      <button type="button" onClick={onRetry}>분석 다시 불러오기</button>
    </details>
  </div>;
}
