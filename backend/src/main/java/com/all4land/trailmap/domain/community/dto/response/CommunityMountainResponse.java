package com.all4land.trailmap.domain.community.dto.response;

public record CommunityMountainResponse(
        Long mountainId,
        String externalId,
        String name,
        double longitude,
        double latitude
) {
}
