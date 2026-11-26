package com.all4land.trailmap.domain.community.dto.response;

import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;

public record CommunitySpotMapResponse(
        CommunitySpotTargetType targetType,
        Long targetId,
        Long mountainId,
        String name,
        CommunitySpotType type,
        double longitude,
        double latitude
) {
}
