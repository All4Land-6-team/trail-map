import type { CourseAnalysis } from '../types/courseAnalysis.ts';
import type { CourseGuideComparisonState, CourseGuideView } from '../types/courseGuide.ts';

/** 분석 없음·실패는 공식 안내를 막지 않고, 확인된 현재 코스 버전이 다르면 혼합하지 않는다. */
export function comparisonGuideView(course: { id: string; analysis: CourseAnalysis | null }, state: CourseGuideComparisonState): CourseGuideView | undefined {
  if (state.status !== 'success') return undefined;
  const result = state.courses.find(item => item.id === course.id);
  if (result?.status !== 'available') return result;
  const analysis = course.analysis;
  if (analysis && (analysis.courseId !== result.guide.courseId || analysis.mountainId !== result.guide.mountainId
    || analysis.currentCourseVersion !== result.guide.courseVersion)) {
    return { id: course.id, status: 'outdated', message: '코스 정보가 변경됐어요. 공식 안내 시간을 다시 불러와 주세요.' };
  }
  return result;
}
