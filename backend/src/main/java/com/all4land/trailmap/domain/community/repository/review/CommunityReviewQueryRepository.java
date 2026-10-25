package com.all4land.trailmap.domain.community.repository.review;

import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.repository.result.CommunityReviewQueryResult;
import com.all4land.trailmap.domain.community.repository.result.EligibleHikeQueryResult;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class CommunityReviewQueryRepository {

    private static final String ELIGIBLE_HIKE_SQL = """
            SELECT DISTINCT ON (record.course_id)
                   record.hike_record_id,
                   record.course_id,
                   course.course_name,
                   course.mountain_id,
                   record.ended_at
            FROM hike_record record
            JOIN course ON course.course_id = record.course_id
            WHERE record.user_id = :userId
              AND course.mountain_id = :mountainId
              AND (CAST(:courseId AS bigint) IS NULL OR record.course_id = CAST(:courseId AS bigint))
              AND record.hike_status = 'COMPLETED'
              AND record.deleted_at IS NULL
              AND record.ended_at BETWEEN :windowStart AND :windowEnd
            ORDER BY record.course_id, record.ended_at DESC, record.hike_record_id DESC
            """;

    private static final String REVIEW_SELECT = """
            SELECT review.review_id,
                   review.target_id,
                   review.hike_record_id,
                   COALESCE(NULLIF(btrim(app_user.nickname), ''), '익명' || app_user.user_id) AS author,
                   review.review_content,
                   review.rating,
                   review.visited_date,
                   review.created_at,
                   photos.photo_keys
            FROM selected_review review
            JOIN app_user ON app_user.user_id = review.user_id
            LEFT JOIN LATERAL (
                SELECT COALESCE(
                        array_agg(photo.object_key ORDER BY photo.display_order, photo.photo_id),
                        ARRAY[]::varchar[]
                       ) AS photo_keys
                FROM photo
                WHERE photo.deleted_at IS NULL
                  AND photo.%s = review.review_id
            ) photos ON TRUE
            ORDER BY review.created_at DESC, review.review_id DESC
            LIMIT :limit OFFSET :offset
            """;

    private static final String MOUNTAIN_REVIEW_SQL = """
            WITH selected_review AS (
                SELECT review.review_id,
                       review.mountain_id AS target_id,
                       review.hike_record_id,
                       review.user_id,
                       review.review_content,
                       review.rating::double precision AS rating,
                       review.visited_date,
                       review.created_at
                FROM mountain_review review
                WHERE review.mountain_id = :targetId
                  AND review.deleted_at IS NULL
            )
            """ + REVIEW_SELECT.formatted("mountain_review_id");

    private static final String COURSE_REVIEW_SQL = """
            WITH selected_review AS (
                SELECT DISTINCT ON (review.user_id)
                       review.review_id,
                       review.course_id AS target_id,
                       review.hike_record_id,
                       review.user_id,
                       review.review_content,
                       NULL::double precision AS rating,
                       review.visited_date,
                       review.created_at
                FROM course_review review
                LEFT JOIN hike_record record ON record.hike_record_id = review.hike_record_id
                WHERE review.course_id = :targetId
                  AND review.deleted_at IS NULL
                ORDER BY review.user_id, record.ended_at DESC NULLS LAST, review.created_at DESC
            )
            """ + REVIEW_SELECT.formatted("course_review_id");

    private static final String SPOT_REVIEW_SQL = """
            WITH selected_review AS (
                SELECT review.review_id,
                       COALESCE(review.facility_id, review.spot_id) AS target_id,
                       review.hike_record_id,
                       review.user_id,
                       review.review_content,
                       NULL::double precision AS rating,
                       review.visited_date,
                       review.created_at
                FROM spot_review review
                WHERE review.deleted_at IS NULL
                  AND ((:targetType = 'FACILITY' AND review.facility_id = :targetId)
                    OR (:targetType = 'USER_SPOT' AND review.spot_id = :targetId))
            )
            """ + REVIEW_SELECT.formatted("spot_review_id");

    private static final RowMapper<CommunityReviewQueryResult> REVIEW_ROW_MAPPER = (resultSet, rowNumber) ->
            new CommunityReviewQueryResult(
                    resultSet.getLong("review_id"),
                    resultSet.getLong("target_id"),
                    resultSet.getObject("hike_record_id", Long.class),
                    resultSet.getString("author"),
                    resultSet.getString("review_content"),
                    resultSet.getObject("rating", Double.class),
                    resultSet.getObject("visited_date", java.time.LocalDate.class),
                    resultSet.getObject("created_at", java.time.OffsetDateTime.class),
                    toStringList(resultSet.getArray("photo_keys"))
            );

    private static final RowMapper<EligibleHikeQueryResult> ELIGIBLE_HIKE_ROW_MAPPER = (resultSet, rowNumber) ->
            new EligibleHikeQueryResult(
                    resultSet.getLong("hike_record_id"),
                    resultSet.getLong("course_id"),
                    resultSet.getString("course_name"),
                    resultSet.getLong("mountain_id"),
                    resultSet.getObject("ended_at", OffsetDateTime.class)
            );

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public boolean existsUser(Long userId) {
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM app_user WHERE user_id = :id)",
                new MapSqlParameterSource("id", userId),
                Boolean.class
        );
        return Boolean.TRUE.equals(exists);
    }

    public Optional<String> findUserDisplayName(Long userId) {
        return jdbcTemplate.query(
                """
                SELECT COALESCE(NULLIF(btrim(nickname), ''), '익명' || user_id) AS display_name
                FROM app_user
                WHERE user_id = :id
                """,
                new MapSqlParameterSource("id", userId),
                (resultSet, rowNumber) -> resultSet.getString("display_name")
        ).stream().findFirst();
    }

    public List<EligibleHikeQueryResult> findEligibleHikes(
            Long userId,
            Long mountainId,
            Long courseId,
            OffsetDateTime windowStart,
            OffsetDateTime windowEnd
    ) {
        var parameters = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("mountainId", mountainId)
                .addValue("courseId", courseId)
                .addValue("windowStart", windowStart)
                .addValue("windowEnd", windowEnd);
        return jdbcTemplate.query(ELIGIBLE_HIKE_SQL, parameters, ELIGIBLE_HIKE_ROW_MAPPER);
    }

    public List<CommunityReviewQueryResult> findMountainReviews(Long mountainId, int limit, int offset) {
        return findReviews(MOUNTAIN_REVIEW_SQL, reviewParameters(mountainId, limit, offset));
    }

    public List<CommunityReviewQueryResult> findCourseReviews(Long courseId, int limit, int offset) {
        return findReviews(COURSE_REVIEW_SQL, reviewParameters(courseId, limit, offset));
    }

    public List<CommunityReviewQueryResult> findSpotReviews(
            CommunitySpotTargetType targetType,
            Long targetId,
            int limit,
            int offset
    ) {
        return findReviews(
                SPOT_REVIEW_SQL,
                reviewParameters(targetId, limit, offset).addValue("targetType", targetType.name())
        );
    }

    private List<CommunityReviewQueryResult> findReviews(String sql, MapSqlParameterSource parameters) {
        return jdbcTemplate.query(sql, parameters, REVIEW_ROW_MAPPER);
    }

    private static MapSqlParameterSource reviewParameters(Long targetId, int limit, int offset) {
        return new MapSqlParameterSource()
                .addValue("targetId", targetId)
                .addValue("limit", limit)
                .addValue("offset", offset);
    }

    private static List<String> toStringList(Array sqlArray) throws SQLException {
        if (sqlArray == null) {
            return List.of();
        }
        return Arrays.stream((Object[]) sqlArray.getArray()).map(String::valueOf).toList();
    }
}
