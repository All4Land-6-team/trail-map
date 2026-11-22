package com.all4land.trailmap.domain.community.weather;

import java.time.OffsetDateTime;

public record ReviewEnvironment(
        OffsetDateTime referenceAt,
        short utcOffsetMinutes,
        double longitude,
        double latitude,
        WeatherStatus weatherStatus,
        Double temperatureC,
        WeatherCode weatherCode
) {
    public static ReviewEnvironment pending(
            OffsetDateTime referenceAt,
            short utcOffsetMinutes,
            double longitude,
            double latitude
    ) {
        return new ReviewEnvironment(
                referenceAt, utcOffsetMinutes, longitude, latitude,
                WeatherStatus.PENDING, null, null
        );
    }
}
