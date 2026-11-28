import type { CourseAnalysisState } from '../../../types/courseAnalysis';

export function CourseAnalysisStatus({ state, development, onRetry }: {
  state: CourseAnalysisState; development: boolean; onRetry: () => void;
}) {
  if (state.status === 'loading') return <p className="course-analysis-status" role="status">코스 분석을 불러오는 중이에요.</p>;
  if (state.status !== 'success') return <div className="course-analysis-status" role={state.status === 'error' ? 'alert' : 'status'}>
    <p>{state.message}</p>
    {state.status === 'error' && <button type="button" onClick={onRetry}>분석 다시 불러오기</button>}
  </div>;
  const { analysis, profileError } = state.data;
  if (!development && !profileError) return null;
  return <div className="course-analysis-status" data-analysis-id={analysis.analysisId ?? ''}>
    {development && <p className="course-analysis-origin">개발용 예시 경로의 분석 결과예요. 실제 등산로 정보가 아니에요.</p>}
    {profileError && <p role="alert">고도·경사 프로필을 불러오지 못했어요. <button type="button" onClick={onRetry}>분석 다시 불러오기</button></p>}
  </div>;
}
