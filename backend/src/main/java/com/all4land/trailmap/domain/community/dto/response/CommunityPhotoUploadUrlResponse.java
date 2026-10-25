package com.all4land.trailmap.domain.community.dto.response;

import java.time.OffsetDateTime;

public record CommunityPhotoUploadUrlResponse(
        String objectKey,
        String uploadUrl,
        OffsetDateTime expiresAt
) {
}
