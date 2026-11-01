package com.all4land.trailmap.domain.community.dto.response;

import java.util.List;

public record CommunityMountainPreviewResponse(
        CommunityMountainReviewSummaryResponse summary,
        List<CommunityReviewResponse> reviews,
        List<CommunityPhotoResponse> photos
) {
}
