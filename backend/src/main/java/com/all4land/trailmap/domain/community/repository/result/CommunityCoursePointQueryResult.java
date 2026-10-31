package com.all4land.trailmap.domain.community.repository.result;

public record CommunityCoursePointQueryResult(
        Long courseId,
        Long mountainId,
        String externalId,
        String name,
        double distanceKm,
        long reviewCount,
        long photoCount,
        int sequence,
        double longitude,
        double latitude
) {
}
