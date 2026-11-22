package com.all4land.trailmap.domain.community.weather;

import com.all4land.trailmap.domain.community.entity.CommunityReviewKind;

import java.time.OffsetDateTime;

public record ReviewEnvironmentWeatherRequest(
        CommunityReviewKind kind,
        Long reviewId,
        Long mountainId,
        OffsetDateTime referenceAt,
        short utcOffsetMinutes,
        double longitude,
        double latitude
) {
}
