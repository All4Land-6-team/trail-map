export type AnalysisQualityStatus = 'AVAILABLE' | 'PARTIAL' | 'NO_DATA' | 'OUTDATED' | 'PROCESSING' | 'FAILED';
export type AnalysisMetrics = {
  distanceMeters: number | null;
  estimatedDurationSeconds: number | null;
  minElevationMeters: number | null;
  maxElevationMeters: number | null;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  steepSectionRatioPercent: number | null;
};
export type AnalysisCoverage = {
  sampleCount: number;
  validDemSampleCount: number;
  validElevationMetersSampleCount: number;
  sampleCoveragePercent: number;
  coveredDistanceMeters: number;
  distanceCoveragePercent: number;
  analyzedSegmentCount: number;
};
export type AnalysisSettings = {
  sampleIntervalMeters: number;
  samplingMethod: string;
  resamplingMethod: string;
  distanceMethod: string;
  elevationUnit: string;
  elevationUnitSource: string;
  verticalReference: string | null;
  elevationProcessing: string;
  slopeConvention: string;
};
export type CourseAnalysis = {
  courseId: number;
  mountainId: number;
  currentCourseVersion: number;
  analysisId: number | null;
  analyzedCourseVersion: number | null;
  demSourceId: number | null;
  algorithmVersion: string | null;
  sourceType: string | null;
  sourceKind: string | null;
  qualityStatus: AnalysisQualityStatus;
  recordedQualityStatus: AnalysisQualityStatus | null;
  qualityReasons: string[];
  calculatedAt: string | null;
  metrics: AnalysisMetrics;
  coverage: AnalysisCoverage | null;
  settings: AnalysisSettings | null;
  profileUrl: string | null;
};
export type AnalysisSample = {
  sampleIndex: number;
  distanceMeters: number;
  coordinate: [longitude: number, latitude: number];
  elevationMeters: number | null;
  slopePercent: number | null;
  sampleStatus: string;
};
export type CourseAnalysisProfile = { analysis: CourseAnalysis; samples: AnalysisSample[] };
export type CourseComparison = {
  mountainId: number;
  mountainName: string;
  courses: { courseId: number; courseName: string; currentCourseVersion: number; analysis: CourseAnalysis }[];
};
export type LoadedCourseComparison = Omit<CourseComparison, 'courses'> & {
  courses: (CourseComparison['courses'][number] & { profile: CourseAnalysisProfile | null; profileError: string | null })[];
};
/** 실제 코스 API 도입 시 응답의 DB ID로 제공한다. 시설 시범 ID와 혼용하지 않는다. */
export type AnalysisCourseReference = { courseId: number; mountainId: number; development: boolean };
export type CourseComparisonState =
  | { status: 'loading' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string }
  | { status: 'success'; data: LoadedCourseComparison };
