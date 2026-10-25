package com.all4land.trailmap.domain.community.repository;

public record CommunityMountainQueryResult(
        Long mountainId,
        String externalId,
        String name,
        double longitude,
        double latitude
) {
}
