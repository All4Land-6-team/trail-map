// API 계약 검증용 소형 합성 데이터. 실제 등산로·DEM 산출물이 아니다.
export function analysis(courseId = 1, overrides = {}) {
  return {
    courseId, mountainId: 1, currentCourseVersion: 1, analysisId: 100 + courseId,
    analyzedCourseVersion: 1, demSourceId: 18, algorithmVersion: 'course-dem-v1',
    sourceType: 'SERVICE_CALCULATED', sourceKind: 'development', qualityStatus: 'PARTIAL',
    recordedQualityStatus: 'PARTIAL', qualityReasons: ['UNVERIFIED_VERTICAL_REFERENCE', 'MISSING_DEM_SAMPLES'],
    calculatedAt: '2026-10-29T00:00:00Z',
    metrics: { distanceMeters: 1500, estimatedDurationSeconds: null, minElevationMeters: 100,
      maxElevationMeters: 820, elevationGainMeters: 712.25, elevationLossMeters: 0, steepSectionRatioPercent: null },
    coverage: { sampleCount: 4, validDemSampleCount: 3, validElevationMetersSampleCount: 3,
      sampleCoveragePercent: 75, coveredDistanceMeters: 500, distanceCoveragePercent: 100 / 3, analyzedSegmentCount: 1 },
    settings: { sampleIntervalMeters: 500, samplingMethod: 'bilinear',
      resamplingMethod: 'horizontal_chainage_preserve_vertices', distanceMethod: 'projected_2d_dem_crs',
      elevationUnit: 'm', elevationUnitSource: 'caller_declaration', verticalReference: null,
      elevationProcessing: 'unsmoothed', slopeConvention: 'signed_percent_from_previous_sample' },
    profileUrl: `/api/v1/course-analyses/${100 + courseId}/profile`, ...overrides,
  };
}
export function noAnalysis(courseId = 2) {
  const value = analysis(courseId);
  return { ...value, analysisId: null, analyzedCourseVersion: null, demSourceId: null,
    algorithmVersion: null, sourceType: null, sourceKind: null, qualityStatus: 'NO_DATA', recordedQualityStatus: null,
    qualityReasons: ['ANALYSIS_NOT_FOUND'], calculatedAt: null,
    metrics: Object.fromEntries(Object.keys(value.metrics).map(key => [key, null])), coverage: null, settings: null, profileUrl: null };
}
export const envelope = data => ({ success: true, data });
export function comparison(summaries = [analysis(1), noAnalysis(2), analysis(3, { qualityStatus: 'OUTDATED', currentCourseVersion: 2 })]) {
  return envelope({ mountainId: 1, mountainName: '북한산', courses: summaries.map(value => ({
    courseId: value.courseId, courseName: ['백운대 코스', '대남문 코스', '비봉 코스'][value.courseId - 1] ?? `코스 ${value.courseId}`,
    currentCourseVersion: value.currentCourseVersion, analysis: value,
  })) });
}
export function profile(summary = analysis(1)) {
  const heights = [100, 812.25, null, 820];
  return envelope({ analysis: structuredClone(summary), samples: heights.map((height, index) => ({
    sampleIndex: index, distanceMeters: index * 500,
    coordinate: [126.98 + summary.courseId * 0.001 + index * 0.001, 37.66 + index * 0.001], elevationMeters: height,
    slopePercent: index === 1 ? 142.45 : null, sampleStatus: height === null ? 'NODATA' : 'VALID',
  })) });
}

export function fullCoverageAnalysis(courseId = 2) {
  const distance = 6119.385314842455;
  const min = 100, max = min + distance * 0.02;
  const value = analysis(courseId, { qualityReasons: ['UNVERIFIED_VERTICAL_REFERENCE'] });
  value.metrics = { ...value.metrics, distanceMeters: distance, minElevationMeters: min,
    maxElevationMeters: max, elevationGainMeters: max - min, elevationLossMeters: 0 };
  value.settings.sampleIntervalMeters = 10;
  value.coverage = { sampleCount: 617, validDemSampleCount: 617, validElevationMetersSampleCount: 617,
    sampleCoveragePercent: 100, coveredDistanceMeters: distance,
    distanceCoveragePercent: 100 * distance / distance, analyzedSegmentCount: 616 };
  return value;
}

export function fullCoverageProfile(value = fullCoverageAnalysis()) {
  const samples = Array.from({ length: value.coverage.sampleCount }, (_, index) => {
    const ratio = index / (value.coverage.sampleCount - 1);
    return { sampleIndex: index, distanceMeters: ratio * value.metrics.distanceMeters,
      coordinate: [126.955 + ratio * 0.038, 37.636 + ratio * 0.045],
      elevationMeters: value.metrics.minElevationMeters + ratio * (value.metrics.maxElevationMeters - value.metrics.minElevationMeters),
      slopePercent: null, sampleStatus: 'VALID' };
  });
  for (let i = 1; i < samples.length; i++) samples[i].slopePercent = 100 * (samples[i].elevationMeters - samples[i - 1].elevationMeters)
    / (samples[i].distanceMeters - samples[i - 1].distanceMeters);
  return envelope({ analysis: value, samples });
}
