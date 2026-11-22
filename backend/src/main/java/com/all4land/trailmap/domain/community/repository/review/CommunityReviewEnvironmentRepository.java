package com.all4land.trailmap.domain.community.repository.review;

import com.all4land.trailmap.domain.community.entity.CommunityReviewKind;
import com.all4land.trailmap.domain.community.repository.result.CommunityReviewEnvironmentQueryResult;
import com.all4land.trailmap.domain.community.weather.ReviewEnvironment;
import com.all4land.trailmap.domain.community.weather.ReviewEnvironmentWeatherRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class CommunityReviewEnvironmentRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public void insert(CommunityReviewKind kind, Long reviewId, ReviewEnvironment environment, String source) {
        String reviewColumn = reviewColumn(kind);
        jdbcTemplate.update("""
                INSERT INTO review_environment (
                    %s, reference_at, utc_offset_minutes, longitude, latitude, source,
                    weather_status, weather_temperature_c, weather_code
                ) VALUES (
                    :reviewId, :referenceAt, :utcOffsetMinutes, :longitude, :latitude, :source,
                    :weatherStatus, :temperatureC, :weatherCode
                )
                """.formatted(reviewColumn), new MapSqlParameterSource()
                .addValue("reviewId", reviewId)
                .addValue("referenceAt", environment.referenceAt())
                .addValue("utcOffsetMinutes", environment.utcOffsetMinutes())
                .addValue("longitude", environment.longitude())
                .addValue("latitude", environment.latitude())
                .addValue("source", source)
                .addValue("weatherStatus", environment.weatherStatus().name())
                .addValue("temperatureC", environment.temperatureC())
                .addValue("weatherCode", environment.weatherCode() == null ? null : environment.weatherCode().name()));
    }

    public Optional<CommunityReviewEnvironmentQueryResult> find(CommunityReviewKind kind, Long reviewId) {
        String reviewColumn = reviewColumn(kind);
        return jdbcTemplate.query("""
                SELECT reference_at, utc_offset_minutes, longitude, latitude,
                       weather_status, weather_temperature_c, weather_code
                FROM review_environment
                WHERE %s = :reviewId
                """.formatted(reviewColumn), new MapSqlParameterSource("reviewId", reviewId),
                (resultSet, rowNumber) -> new CommunityReviewEnvironmentQueryResult(
                        resultSet.getObject("reference_at", java.time.OffsetDateTime.class),
                        resultSet.getObject("utc_offset_minutes", Short.class),
                        resultSet.getObject("longitude", Double.class),
                        resultSet.getObject("latitude", Double.class),
                        resultSet.getString("weather_status"),
                        resultSet.getObject("weather_temperature_c", Double.class),
                        resultSet.getString("weather_code")
                )).stream().findFirst();
    }

    public void updateWeather(CommunityReviewKind kind, Long reviewId, ReviewEnvironment environment) {
        String reviewColumn = reviewColumn(kind);
        jdbcTemplate.update("""
                UPDATE review_environment
                SET weather_status = :weatherStatus,
                    weather_temperature_c = :temperatureC,
                    weather_code = :weatherCode
                WHERE %s = :reviewId
                """.formatted(reviewColumn), new MapSqlParameterSource()
                .addValue("reviewId", reviewId)
                .addValue("weatherStatus", environment.weatherStatus().name())
                .addValue("temperatureC", environment.temperatureC())
                .addValue("weatherCode", environment.weatherCode() == null ? null : environment.weatherCode().name()));
    }

    public List<ReviewEnvironmentWeatherRequest> findRetryCandidates(int limit) {
        return jdbcTemplate.query("""
                SELECT candidate.kind, candidate.review_id, candidate.mountain_id,
                       candidate.reference_at, candidate.utc_offset_minutes,
                       candidate.longitude, candidate.latitude
                FROM (
                    SELECT 'MOUNTAIN' AS kind, environment.mountain_review_id AS review_id,
                           review.mountain_id, environment.reference_at, environment.utc_offset_minutes,
                           environment.longitude, environment.latitude, environment.created_at
                    FROM review_environment environment
                    JOIN mountain_review review ON review.review_id = environment.mountain_review_id
                    WHERE environment.weather_status IN ('PENDING', 'FAILED')
                       OR environment.weather_temperature_c NOT BETWEEN -100 AND 100
                    UNION ALL
                    SELECT 'COURSE', environment.course_review_id, course.mountain_id,
                           environment.reference_at, environment.utc_offset_minutes,
                           environment.longitude, environment.latitude, environment.created_at
                    FROM review_environment environment
                    JOIN course_review review ON review.review_id = environment.course_review_id
                    JOIN course ON course.course_id = review.course_id
                    WHERE environment.weather_status IN ('PENDING', 'FAILED')
                       OR environment.weather_temperature_c NOT BETWEEN -100 AND 100
                    UNION ALL
                    SELECT 'SPOT', environment.spot_review_id,
                           COALESCE(spot.mountain_id, facility.mountain_id),
                           environment.reference_at, environment.utc_offset_minutes,
                           environment.longitude, environment.latitude, environment.created_at
                    FROM review_environment environment
                    JOIN spot_review review ON review.review_id = environment.spot_review_id
                    LEFT JOIN user_spot spot ON spot.spot_id = review.spot_id
                    LEFT JOIN facility ON facility.facility_id = review.facility_id
                    WHERE environment.weather_status IN ('PENDING', 'FAILED')
                       OR environment.weather_temperature_c NOT BETWEEN -100 AND 100
                ) candidate
                WHERE candidate.mountain_id IS NOT NULL
                ORDER BY candidate.created_at
                LIMIT :limit
                """, new MapSqlParameterSource("limit", limit),
                (resultSet, rowNumber) -> new ReviewEnvironmentWeatherRequest(
                        CommunityReviewKind.valueOf(resultSet.getString("kind")),
                        resultSet.getLong("review_id"),
                        resultSet.getLong("mountain_id"),
                        resultSet.getObject("reference_at", java.time.OffsetDateTime.class),
                        resultSet.getShort("utc_offset_minutes"),
                        resultSet.getDouble("longitude"),
                        resultSet.getDouble("latitude")
                ));
    }

    private static String reviewColumn(CommunityReviewKind kind) {
        return switch (kind) {
            case MOUNTAIN -> "mountain_review_id";
            case COURSE -> "course_review_id";
            case SPOT -> "spot_review_id";
        };
    }
}
