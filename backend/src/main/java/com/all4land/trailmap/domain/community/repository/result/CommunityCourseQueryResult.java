package com.all4land.trailmap.domain.community.repository.result;

public record CommunityCourseQueryResult(
        Long courseId,
        Long mountainId,
        String externalId,
        String name,
        double distanceKm,
        long reviewCount,
        Double averageRating,
        long photoCount,
        String representativePhotoKey,
        String routeGeoJson
) {
}
