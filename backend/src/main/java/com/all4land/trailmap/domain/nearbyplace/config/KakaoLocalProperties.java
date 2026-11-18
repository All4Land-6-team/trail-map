package com.all4land.trailmap.domain.nearbyplace.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "kakao.local")
public record KakaoLocalProperties(
        String restApiKey,
        String baseUrl,
        Duration connectTimeout,
        Duration readTimeout,
        Duration requestTimeout,
        int searchRadiusMeters,
        int maxDistanceFromCourseMeters,
        double sampleIntervalMeters,
        int maxSamplePoints,
        int maxPages,
        int maxConcurrentRequests,
        Duration cacheTtl
) {
    public KakaoLocalProperties {
        if (baseUrl == null || baseUrl.isBlank()) throw new IllegalArgumentException("Kakao Local base URL is required");
        if (connectTimeout == null || connectTimeout.isZero() || connectTimeout.isNegative()) {
            throw new IllegalArgumentException("Kakao Local connect timeout must be positive");
        }
        if (readTimeout == null || readTimeout.isZero() || readTimeout.isNegative()) {
            throw new IllegalArgumentException("Kakao Local read timeout must be positive");
        }
        if (requestTimeout == null || requestTimeout.isZero() || requestTimeout.isNegative()) {
            throw new IllegalArgumentException("Kakao Local request timeout must be positive");
        }
        if (searchRadiusMeters < 1 || searchRadiusMeters > 20_000) {
            throw new IllegalArgumentException("Kakao Local search radius must be between 1 and 20000 meters");
        }
        if (maxDistanceFromCourseMeters < 1 || maxDistanceFromCourseMeters > searchRadiusMeters) {
            throw new IllegalArgumentException("Course distance must be within the Kakao search radius");
        }
        if (sampleIntervalMeters <= 0 || maxSamplePoints < 2 || maxSamplePoints > 10
                || sampleIntervalMeters > searchRadiusMeters * 2.0 || maxPages < 1 || maxPages > 3) {
            throw new IllegalArgumentException("Kakao Local sampling policy is invalid");
        }
        if (maxConcurrentRequests < 1 || maxConcurrentRequests > 8) {
            throw new IllegalArgumentException("Kakao Local concurrency must be between 1 and 8");
        }
        if (cacheTtl == null || cacheTtl.isZero() || cacheTtl.isNegative()) {
            throw new IllegalArgumentException("Kakao Local cache TTL must be positive");
        }
    }

    public boolean configured() {
        return restApiKey != null && !restApiKey.isBlank() && !"not-configured".equals(restApiKey);
    }
}
