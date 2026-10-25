package com.all4land.trailmap.domain.community.dto.response;

import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunityVoteType;

public record CommunitySpotVoteResponse(
        CommunitySpotTargetType targetType,
        Long targetId,
        long yesVotes,
        long noVotes,
        CommunityVoteType viewerVote,
        String status,
        boolean hidden
) {
}
