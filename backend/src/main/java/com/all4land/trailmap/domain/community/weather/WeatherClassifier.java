package com.all4land.trailmap.domain.community.weather;

import java.util.Locale;

final class WeatherClassifier {

    private WeatherClassifier() {
    }

    static WeatherCode classify(KmaGridObservation grid, KmaAsosObservation asos) {
        if (isPhenomenon(asos, 95, 99, "뇌우", "천둥", "번개", "thunder")) return WeatherCode.THUNDERSTORM;
        if (positive(grid == null ? null : grid.threeHourSnowCm())
                || isPhenomenon(asos, 70, 79, "눈", "진눈깨비", "snow")) return WeatherCode.SNOW;
        if (positive(grid == null ? null : grid.rainOccurrence())
                || positive(grid == null ? null : grid.hourlyRainMm())
                || isPhenomenon(asos, 50, 69, "비", "이슬비", "소나기", "rain", "drizzle")) return WeatherCode.RAIN;
        if ((grid != null && grid.visibilityKilometers() != null && grid.visibilityKilometers() < 1)
                || isPhenomenon(asos, 40, 49, "안개", "박무", "fog", "mist")) return WeatherCode.FOG;
        if (asos == null || asos.totalCloudAmount() == null) return null;
        if (asos.totalCloudAmount() <= 2) return WeatherCode.SUNNY;
        if (asos.totalCloudAmount() <= 8) return WeatherCode.PARTLY_CLOUDY;
        return WeatherCode.CLOUDY;
    }

    private static boolean positive(Double value) {
        return value != null && value > 0;
    }

    private static boolean isPhenomenon(KmaAsosObservation observation, int minimumCode, int maximumCode, String... words) {
        if (observation == null) return false;
        Integer code = observation.currentWeatherCode();
        if (code != null && code >= minimumCode && code <= maximumCode) return true;
        if (observation.domesticWeather() == null) return false;
        String normalized = observation.domesticWeather().toLowerCase(Locale.ROOT);
        for (String word : words) {
            if (normalized.contains(word)) return true;
        }
        return false;
    }
}
