package com.all4land.trailmap.domain.community.repository.result;

import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;

public record CommunityVoteTargetQueryResult(
        CommunitySpotTargetType targetType,
        Long targetId,
        String status
) {
}
