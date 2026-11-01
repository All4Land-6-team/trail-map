package com.all4land.trailmap.domain.community.repository.result;

import java.time.OffsetDateTime;

public record CommunityPhotoQueryResult(
        Long photoId,
        String objectKey,
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
