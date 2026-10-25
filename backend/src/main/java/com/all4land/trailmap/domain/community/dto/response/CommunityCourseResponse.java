package com.all4land.trailmap.domain.community.dto.response;

import java.util.List;

public record CommunityCourseResponse(
        Long courseId,
        Long mountainId,
        String externalId,
        String name,
        double distanceKm,
        long reviewCount,
        List<CommunityCoordinateResponse> coordinates
) {
}
