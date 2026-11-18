package com.all4land.trailmap.domain.nearbyplace.dto.response;

public record NearbyPlaceResponse(
        String sourceType,
        String placeId,
        String name,
        String category,
        double longitude,
        double latitude,
        String address,
        String roadAddress,
        String phone,
        String placeUrl,
        int distanceFromCourseMeters
) {}
