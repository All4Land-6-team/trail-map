import type { AnalysisCourseReference } from './courseAnalysis';

export type GuideCourseReference = {
  id: string;
  mountainId?: string;
  analysisReference?: AnalysisCourseReference;
};

export type OfficialCourseGuide = {
  courseId: number;
  mountainId: number;
  courseVersion: number;
  durationSeconds: number;
  routeLabel: string;
  sourceUrl: string;
  checkedOn: string;
};

export type CourseGuideResult =
  | { id: string; status: 'available'; guide: OfficialCourseGuide }
  | { id: string; status: 'missing' | 'error'; message: string };

export type CourseGuideComparisonState =
  | { status: 'loading' }
  | { status: 'unavailable' | 'error'; message: string }
  | { status: 'success'; courses: readonly CourseGuideResult[] };

export type CourseGuideView = CourseGuideResult
  | { id: string; status: 'outdated'; message: string };
