package com.all4land.trailmap.domain.community.dto.response;

import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import com.all4land.trailmap.domain.community.entity.CommunityVoteType;

public record CommunitySpotMapResponse(
        CommunitySpotTargetType targetType,
        Long targetId,
        Long mountainId,
        String name,
        CommunitySpotType type,
        double longitude,
        double latitude,
        String status,
        long yesVotes,
        long noVotes,
        CommunityVoteType viewerVote
) {
}
