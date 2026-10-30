package com.all4land.trailmap.domain.courseanalysis.dto.response;

import com.all4land.trailmap.domain.courseanalysis.entity.AnalysisQualityStatus;

import java.time.OffsetDateTime;
import java.util.List;

public record CourseAnalysisResponse(
        long courseId, long mountainId, int currentCourseVersion, Long analysisId, Integer analyzedCourseVersion,
        Long demSourceId, String algorithmVersion, String sourceType, String sourceKind,
        AnalysisQualityStatus qualityStatus, AnalysisQualityStatus recordedQualityStatus,
        List<String> qualityReasons, OffsetDateTime calculatedAt, Metrics metrics, Coverage coverage,
        Settings settings, String profileUrl
) {
    public record Metrics(Double distanceMeters, Integer estimatedDurationSeconds, Double minElevationMeters,
                          Double maxElevationMeters, Double elevationGainMeters, Double elevationLossMeters,
                          Double steepSectionRatioPercent) {}

    public record Coverage(int sampleCount, int validDemSampleCount, int validElevationMetersSampleCount,
                           double sampleCoveragePercent, double coveredDistanceMeters,
                           double distanceCoveragePercent, int analyzedSegmentCount) {}

    public record Settings(double sampleIntervalMeters, String samplingMethod, String resamplingMethod,
                           String distanceMethod, String elevationUnit, String elevationUnitSource,
                           String verticalReference, String elevationProcessing, String slopeConvention) {}
}
