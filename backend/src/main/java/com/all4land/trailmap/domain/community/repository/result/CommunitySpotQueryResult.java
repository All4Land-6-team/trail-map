package com.all4land.trailmap.domain.community.repository.result;

import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import com.all4land.trailmap.domain.community.entity.CommunityVoteType;

import java.time.OffsetDateTime;

public record CommunitySpotQueryResult(
        CommunitySpotTargetType targetType,
        Long targetId,
        Long mountainId,
        String name,
        CommunitySpotType type,
        double longitude,
        double latitude,
        String status,
        String sourceName,
        String sourceUrl,
        long yesVotes,
        long noVotes,
        CommunityVoteType viewerVote,
        long reviewCount,
        long photoCount,
        String representativePhotoKey,
        OffsetDateTime latestReviewAt
) {
}
