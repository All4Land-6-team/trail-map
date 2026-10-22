package com.all4land.trailmap.domain.hike.repository;

public record HikeCourseSummary(
        Long courseId,
        String courseName,
        Long mountainId,
        String mountainName,
        Double distanceMeters,
        Integer durationSeconds
) {
}
