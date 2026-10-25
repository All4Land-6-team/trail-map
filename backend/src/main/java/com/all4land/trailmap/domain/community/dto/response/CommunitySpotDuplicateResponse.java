package com.all4land.trailmap.domain.community.dto.response;

import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;

public record CommunitySpotDuplicateResponse(
        CommunitySpotTargetType targetType,
        Long targetId,
        String name,
        CommunitySpotType type,
        double longitude,
        double latitude,
        double distanceMeters,
        boolean official,
        String status
) {
}
