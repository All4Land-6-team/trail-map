package com.all4land.trailmap.domain.community.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record CommunityReviewPageRequest(
        @Min(1) @Max(100) Integer limit,
        @Min(0) Integer offset
) {

    public int resolvedLimit() {
        return limit == null ? 20 : limit;
    }

    public int resolvedOffset() {
        return offset == null ? 0 : offset;
    }
}
