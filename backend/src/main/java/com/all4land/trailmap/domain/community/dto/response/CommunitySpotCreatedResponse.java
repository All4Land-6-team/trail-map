package com.all4land.trailmap.domain.community.dto.response;

import com.all4land.trailmap.domain.community.entity.CommunitySpotType;

public record CommunitySpotCreatedResponse(
        Long spotId,
        Long mountainId,
        String name,
        CommunitySpotType type,
        double longitude,
        double latitude,
        String status
) {
}
