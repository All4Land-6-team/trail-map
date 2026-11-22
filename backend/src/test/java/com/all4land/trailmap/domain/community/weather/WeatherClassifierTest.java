package com.all4land.trailmap.domain.community.weather;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class WeatherClassifierTest {

    private static final OffsetDateTime OBSERVED_AT = OffsetDateTime.parse("2026-11-19T12:00:00+09:00");

    @Test
    void 강수와_운량이_함께_있으면_비를_우선한다() {
        var grid = new KmaGridObservation(OBSERVED_AT, 12.3, 1.0, 2.0, 8_000.0, 0.0);
        var asos = new KmaAsosObservation(OBSERVED_AT, 10.0, null, null);

        assertThat(WeatherClassifier.classify(grid, asos)).isEqualTo(WeatherCode.RAIN);
    }

    @Test
    void 운량으로_맑음과_구름조금을_구분한다() {
        var sunny = new KmaAsosObservation(OBSERVED_AT, 2.0, null, null);
        var partlyCloudy = new KmaAsosObservation(OBSERVED_AT, 6.0, null, null);

        assertThat(WeatherClassifier.classify(null, sunny)).isEqualTo(WeatherCode.SUNNY);
        assertThat(WeatherClassifier.classify(null, partlyCloudy)).isEqualTo(WeatherCode.PARTLY_CLOUDY);
    }

    @Test
    void 시정이_천미터_미만이면_안개로_분류한다() {
        var grid = new KmaGridObservation(OBSERVED_AT, 8.0, 0.0, 0.0, 0.9, 0.0);

        assertThat(WeatherClassifier.classify(grid, null)).isEqualTo(WeatherCode.FOG);
    }

    @Test
    void 시정이_천미터_이상이면_안개로_분류하지_않는다() {
        var grid = new KmaGridObservation(OBSERVED_AT, 8.0, 0.0, 0.0, 45.2, 0.0);

        assertThat(WeatherClassifier.classify(grid, null)).isNull();
    }
}
