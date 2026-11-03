package com.all4land.trailmap.domain.courseanalysis.dto.request;

import com.all4land.trailmap.domain.courseanalysis.entity.AnalysisQualityStatus;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Python schema_version=1·2 산출물. API 응답에는 로컬 입력 경로를 노출하지 않는다. */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CourseAnalysisDocument(
        Integer schemaVersion, String algorithmVersion, String sourceType, OffsetDateTime calculatedAt,
        AnalysisQualityStatus qualityStatus, List<String> qualityReasons, Course course, Inputs inputs,
        Settings settings, Diagnostics diagnostics, Summary summary, List<Sample> profile
) {
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Course(Long courseId, Long mountainId, Integer courseVersion, Long sourceId,
                         String courseName, String sourceKind, Geometry geometry) {}

    public record Geometry(String type, List<List<Double>> coordinates) {}

    public record Inputs(InputFile course, Dem dem) {}

    public record InputFile(String path, String sha256) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Dem(String path, String sha256, String crsWkt, List<String> crsAuthority,
                      String linearUnit, Double linearUnitToMeters, String bandUnit,
                      Double bandScale, Double bandOffset, List<InputFile> auxiliaryFiles) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    // v2 추가 필드의 null을 생략해 저장된 v1 문서의 직렬화·지문을 유지한다.
    public record Settings(Double sampleIntervalMeters, String samplingMethod, String resamplingMethod,
                           String distanceMethod, String elevationUnit, String elevationUnitSource,
                           String verticalReference, String elevationProcessing, String slopeConvention,
                           Integer maxSamples,
                           @JsonInclude(JsonInclude.Include.NON_NULL) Double steepSlopeThresholdPercent,
                           @JsonInclude(JsonInclude.Include.NON_NULL) String steepSlopeMethod) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Diagnostics(Integer removedConsecutiveDuplicateCount, Map<String, Integer> sampleStatusCounts) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Summary(Double distanceMeters, Integer sampleCount, Integer validDemSampleCount,
                          Integer validElevationMetersSampleCount, Double sampleCoveragePercent,
                          Double coveredDistanceMeters, Double distanceCoveragePercent,
                          Double minElevationMeters, Double maxElevationMeters,
                          Double elevationGainMeters, Double elevationLossMeters, Integer analyzedSegmentCount,
                          @JsonInclude(JsonInclude.Include.NON_NULL) Double slopeAnalyzedDistanceMeters,
                          @JsonInclude(JsonInclude.Include.NON_NULL) Double steepDistanceMeters,
                          @JsonInclude(JsonInclude.Include.NON_NULL) Double steepSectionRatioPercent) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Sample(Integer sampleIndex, Double distanceMeters, Double longitude, Double latitude,
                         Double elevationSourceValue, Double elevationMeters, Double slopePercent,
                         String sampleStatus) {}
}
