package com.all4land.trailmap.domain.community.weather;

import java.time.OffsetDateTime;

record KmaGridObservation(
        OffsetDateTime observedAt,
        Double temperatureC,
        Double rainOccurrence,
        Double hourlyRainMm,
        Double visibilityKilometers,
        Double threeHourSnowCm
) {
}

record KmaAsosObservation(
        OffsetDateTime observedAt,
        Double totalCloudAmount,
        Integer currentWeatherCode,
        String domesticWeather
) {
}
