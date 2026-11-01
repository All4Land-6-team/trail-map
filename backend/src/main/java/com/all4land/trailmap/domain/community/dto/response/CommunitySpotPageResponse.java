package com.all4land.trailmap.domain.community.dto.response;

import java.util.List;

public record CommunitySpotPageResponse(
        List<CommunitySpotResponse> items,
        String nextCursor,
        boolean hasNext
) {
}
