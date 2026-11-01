package com.all4land.trailmap.domain.courseroute.dto.response;

import java.util.List;

public record CourseRouteResponse(long courseId, long mountainId, String mountainKey, String courseName,
                                  int courseVersion, String routeLabel, double distanceMeters,
                                  Double officialDistanceMeters, Integer durationSeconds, String difficulty,
                                  Geometry geometry, Source source, Guide guide) {
    public record Guide(String officialCourseId, String routeLabel, String difficultyGrade, String sourceUrl, String checkedOn) {}
    public record Geometry(String type, List<List<Double>> coordinates) {}
    public record Source(String name, String provider, String url, String version, String recordId,
                         String validationStatus, String checkNote) {}
}
