package com.all4land.trailmap.domain.community.repository;

import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;

public record CommunityVoteTargetQueryResult(
        CommunitySpotTargetType targetType,
        Long targetId,
        String status
) {
}
