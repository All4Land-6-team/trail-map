package com.all4land.trailmap.domain.community.repository.result;

import com.all4land.trailmap.domain.community.entity.CommunitySpotType;

public record CreatedUserSpotQueryResult(
        Long spotId,
        Long mountainId,
        Long hikeRecordId,
        CommunitySpotType type,
        String name,
        double longitude,
        double latitude,
        String status
) {
}
