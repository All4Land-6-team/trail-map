package com.all4land.trailmap.domain.community.repository.result;

import java.time.OffsetDateTime;

public record CommunityReviewEnvironmentQueryResult(
        OffsetDateTime referenceAt,
        Short utcOffsetMinutes,
        Double longitude,
        Double latitude,
        String weatherStatus,
        Double temperatureC,
        String weatherCode
) {
}
