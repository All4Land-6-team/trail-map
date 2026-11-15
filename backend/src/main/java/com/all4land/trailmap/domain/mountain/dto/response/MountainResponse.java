package com.all4land.trailmap.domain.mountain.dto.response;

public record MountainResponse(
        Long mountainId,
        String externalId,
        String name,
        double longitude,
        double latitude
) {
}
