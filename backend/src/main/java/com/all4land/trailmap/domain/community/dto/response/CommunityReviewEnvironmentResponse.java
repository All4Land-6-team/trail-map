package com.all4land.trailmap.domain.community.dto.response;

import com.all4land.trailmap.domain.community.weather.WeatherCode;
import com.all4land.trailmap.domain.community.weather.WeatherStatus;

import java.time.OffsetDateTime;

public record CommunityReviewEnvironmentResponse(
        OffsetDateTime referenceAt,
        short utcOffsetMinutes,
        double longitude,
        double latitude,
        WeatherStatus weatherStatus,
        Double temperatureC,
        WeatherCode weatherCode
) {
}
