package com.all4land.trailmap.domain.hike.repository;

import com.all4land.trailmap.domain.hike.dto.response.HikeRecordReviewResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 등산 기록으로 작성한 커뮤니티 후기를 읽기만 한다. 후기 작성·수정은 커뮤니티 API가 맡는다. */
@Repository
@RequiredArgsConstructor
public class HikeRecordReviewRepository {

    private static final String REVIEWS_SQL = """
            SELECT 'MOUNTAIN' AS kind, review.review_id, 'MOUNTAIN' AS target_type, review.mountain_id AS target_id,
                   mountain.mountain_name AS target_name, NULL::NUMERIC AS rating, review.review_content,
                   review.visited_date, review.created_at, 1 AS kind_order
            FROM mountain_review review
            JOIN mountain ON mountain.mountain_id = review.mountain_id
            WHERE review.hike_record_id = :hikeRecordId AND review.user_id = :userId AND review.deleted_at IS NULL
            UNION ALL
            SELECT 'COURSE', review.review_id, 'COURSE', review.course_id,
                   course.course_name, review.rating, review.review_content,
                   review.visited_date, review.created_at, 2
            FROM course_review review
            JOIN course ON course.course_id = review.course_id
            WHERE review.hike_record_id = :hikeRecordId AND review.user_id = :userId AND review.deleted_at IS NULL
            UNION ALL
            SELECT 'SPOT', review.review_id,
                   CASE WHEN review.spot_id IS NOT NULL THEN 'USER_SPOT' ELSE 'FACILITY' END,
                   COALESCE(review.spot_id, review.facility_id),
                   COALESCE(spot.spot_name, facility.facility_name), NULL, review.review_content,
                   review.visited_date, review.created_at, 3
            FROM spot_review review
            LEFT JOIN user_spot spot ON spot.spot_id = review.spot_id
            LEFT JOIN facility ON facility.facility_id = review.facility_id
            WHERE review.hike_record_id = :hikeRecordId AND review.user_id = :userId AND review.deleted_at IS NULL
            ORDER BY kind_order, created_at, review_id
            """;

    private static final String PHOTOS_SQL = """
            SELECT photo_id, mountain_review_id, course_review_id, spot_review_id
            FROM photo
            WHERE deleted_at IS NULL
              AND (mountain_review_id IN (:mountainReviewIds)
                   OR course_review_id IN (:courseReviewIds)
                   OR spot_review_id IN (:spotReviewIds))
            ORDER BY display_order, photo_id
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public List<HikeRecordReviewResponse> findReviews(Long userId, Long hikeRecordId) {
        List<ReviewRow> rows = jdbcTemplate.query(REVIEWS_SQL, new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("hikeRecordId", hikeRecordId), (resultSet, rowNumber) -> {
            BigDecimal rating = resultSet.getBigDecimal("rating");
            Date visitedDate = resultSet.getDate("visited_date");
            return new ReviewRow(
                    resultSet.getString("kind"),
                    resultSet.getLong("review_id"),
                    resultSet.getString("target_type"),
                    resultSet.getLong("target_id"),
                    resultSet.getString("target_name"),
                    rating == null ? null : rating.doubleValue(),
                    resultSet.getString("review_content"),
                    visitedDate == null ? null : visitedDate.toLocalDate(),
                    resultSet.getObject("created_at", OffsetDateTime.class)
            );
        });
        Map<String, List<Long>> photos = findPhotoIds(rows);
        return rows.stream()
                .map(row -> new HikeRecordReviewResponse(row.kind(), row.reviewId(), row.targetType(), row.targetId(),
                        row.targetName(), row.rating(), row.content(), row.visitedDate(), row.createdAt(),
                        photos.getOrDefault(photoKey(row.kind(), row.reviewId()), List.of())))
                .toList();
    }

    /** 리뷰 종류별 번호로 사진을 한 번에 읽는다. IN 절이 비지 않도록 없는 번호(-1)를 넣는다. */
    private Map<String, List<Long>> findPhotoIds(List<ReviewRow> rows) {
        if (rows.isEmpty()) {
            return Map.of();
        }
        Map<String, List<Long>> photos = new HashMap<>();
        jdbcTemplate.query(PHOTOS_SQL, new MapSqlParameterSource()
                .addValue("mountainReviewIds", reviewIds(rows, "MOUNTAIN"))
                .addValue("courseReviewIds", reviewIds(rows, "COURSE"))
                .addValue("spotReviewIds", reviewIds(rows, "SPOT")), resultSet -> {
            String key = resultSet.getObject("mountain_review_id") != null
                    ? photoKey("MOUNTAIN", resultSet.getLong("mountain_review_id"))
                    : resultSet.getObject("course_review_id") != null
                    ? photoKey("COURSE", resultSet.getLong("course_review_id"))
                    : photoKey("SPOT", resultSet.getLong("spot_review_id"));
            photos.computeIfAbsent(key, ignored -> new ArrayList<>()).add(resultSet.getLong("photo_id"));
        });
        return photos;
    }

    private static List<Long> reviewIds(List<ReviewRow> rows, String kind) {
        List<Long> ids = rows.stream().filter(row -> row.kind().equals(kind)).map(ReviewRow::reviewId).toList();
        return ids.isEmpty() ? List.of(-1L) : ids;
    }

    private static String photoKey(String kind, long reviewId) {
        return kind + ":" + reviewId;
    }

    private record ReviewRow(String kind, Long reviewId, String targetType, Long targetId, String targetName,
                             Double rating, String content, java.time.LocalDate visitedDate, OffsetDateTime createdAt) {
    }
}
