package com.all4land.trailmap.domain.courseanalysis.dto.response;

import java.util.List;

public record CourseAnalysisProfileResponse(CourseAnalysisResponse analysis, List<Sample> samples) {
    public record Sample(int sampleIndex, double distanceMeters, List<Double> coordinate,
                         Double elevationMeters, Double slopePercent, String sampleStatus) {}
}
