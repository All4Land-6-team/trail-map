package com.all4land.trailmap.domain.community.dto.response;

import java.util.List;

public record CommunityReviewPreviewResponse(
        List<CommunityReviewResponse> reviews,
        List<CommunityPhotoResponse> photos
) {
}
