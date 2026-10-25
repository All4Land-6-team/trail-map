package com.all4land.trailmap.domain.community.dto.request;

import com.all4land.trailmap.domain.community.entity.CommunityVoteType;
import jakarta.validation.constraints.NotNull;

public record CommunitySpotVoteRequest(
        @NotNull CommunityVoteType voteType
) {
}
