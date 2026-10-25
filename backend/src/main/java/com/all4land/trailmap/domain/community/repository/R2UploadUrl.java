package com.all4land.trailmap.domain.community.repository;

import java.time.OffsetDateTime;

public record R2UploadUrl(
        String url,
        OffsetDateTime expiresAt
) {
}
