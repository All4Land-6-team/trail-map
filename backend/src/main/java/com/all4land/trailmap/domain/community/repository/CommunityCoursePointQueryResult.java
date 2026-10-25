package com.all4land.trailmap.domain.community.repository;

public record CommunityCoursePointQueryResult(
        Long courseId,
        Long mountainId,
        String externalId,
        String name,
        double distanceKm,
        long reviewCount,
        int sequence,
        double longitude,
        double latitude
) {
}
