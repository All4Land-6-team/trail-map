package com.all4land.trailmap.domain.community.dto.response;

import java.time.OffsetDateTime;

public record CommunityPhotoResponse(
        Long photoId,
        String url,
        String originalFileName,
        String mediaType,
        long fileSizeBytes,
        int displayOrder,
        String author,
        String reviewContent,
        OffsetDateTime createdAt,
        Double reviewRating
) {
}
