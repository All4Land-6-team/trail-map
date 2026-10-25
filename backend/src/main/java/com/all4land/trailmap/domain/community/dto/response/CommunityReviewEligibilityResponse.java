package com.all4land.trailmap.domain.community.dto.response;

import java.util.List;

public record CommunityReviewEligibilityResponse(
        boolean eligible,
        List<EligibleHikeResponse> hikes
) {

    public static CommunityReviewEligibilityResponse from(List<EligibleHikeResponse> hikes) {
        return new CommunityReviewEligibilityResponse(!hikes.isEmpty(), hikes);
    }
}
