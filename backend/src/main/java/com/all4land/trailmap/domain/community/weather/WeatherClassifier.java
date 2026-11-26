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
        WeatherCode skyCondition = skyCondition(asos == null ? null : asos.domesticWeather());
        if (skyCondition != null) return skyCondition;
        if (asos == null || asos.totalCloudAmount() == null) return null;
        if (asos.totalCloudAmount() <= 2) return WeatherCode.SUNNY;
        if (asos.totalCloudAmount() <= 8) return WeatherCode.PARTLY_CLOUDY;
        return WeatherCode.CLOUDY;
    }

    private static WeatherCode skyCondition(String weather) {
        if (weather == null) return null;
        String normalized = weather.toLowerCase(Locale.ROOT);
        if (normalized.contains("맑음") || normalized.contains("쾌청") || normalized.contains("clear")
                || normalized.contains("sunny")) return WeatherCode.SUNNY;
        if (normalized.contains("구름조금") || normalized.contains("partly cloudy")
                || normalized.contains("partly_cloudy")) return WeatherCode.PARTLY_CLOUDY;
        if (normalized.contains("구름많음") || normalized.contains("흐림")
                || normalized.contains("cloudy") || normalized.contains("overcast")) {
            return WeatherCode.CLOUDY;
        }
        return null;
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
