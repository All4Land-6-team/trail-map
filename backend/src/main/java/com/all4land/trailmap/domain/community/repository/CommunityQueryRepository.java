package com.all4land.trailmap.domain.community.repository;

import com.all4land.trailmap.domain.community.dto.request.CommunitySpotMapRequest;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import com.all4land.trailmap.domain.community.entity.CommunityVoteType;
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
public class CommunityQueryRepository {

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

    private static final String SPOT_CTE = """
            WITH community_spot AS (
                SELECT 'FACILITY' AS target_type,
                       facility.facility_id AS target_id,
                       facility.mountain_id,
                       COALESCE(facility.facility_name, '이름 없는 시설') AS name,
                       CASE UPPER(facility.facility_type)
                           WHEN 'REST_AREA' THEN 'SHELTER'
                           WHEN 'SHELTER' THEN 'SHELTER'
                           WHEN 'DRINKING_FOUNTAIN' THEN 'WATER'
                           WHEN 'WATER' THEN 'WATER'
                           WHEN 'SPRING' THEN 'WATER'
                           WHEN 'RESTROOM' THEN 'RESTROOM'
                           WHEN 'TOILET' THEN 'RESTROOM'
                           WHEN 'PHOTO_SPOT' THEN 'PHOTO'
                           WHEN 'VIEWPOINT' THEN 'PHOTO'
                           ELSE 'OTHER'
                       END AS spot_type,
                       facility.facility_location AS location,
                       TRUE AS official,
                       COALESCE(facility.official_status, 'OFFICIAL') AS status,
                       source.source_name,
                       source.source_url
                FROM facility
                JOIN data_source source ON source.source_id = facility.source_id
                WHERE facility.mountain_id = :mountainId

                UNION ALL

                SELECT 'USER_SPOT' AS target_type,
                       spot.spot_id AS target_id,
                       spot.mountain_id,
                       COALESCE(spot.spot_name, '이름 없는 스팟') AS name,
                       CASE spot.spot_type
                           WHEN 'REST_AREA' THEN 'SHELTER'
                           WHEN 'DRINKING_FOUNTAIN' THEN 'WATER'
                           WHEN 'RESTROOM' THEN 'RESTROOM'
                           WHEN 'PHOTO_SPOT' THEN 'PHOTO'
                           ELSE 'OTHER'
                       END AS spot_type,
                       spot.spot_location AS location,
                       FALSE AS official,
                       spot.spot_status AS status,
                       NULL::varchar AS source_name,
                       NULL::varchar AS source_url
                FROM user_spot spot
                WHERE spot.mountain_id = :mountainId
                  AND spot.deleted_at IS NULL
                  AND spot.spot_status <> 'HIDDEN'
            )
            """;

    private static final String SPOT_SELECT = """
            SELECT spot.target_type,
                   spot.target_id,
                   spot.mountain_id,
                   spot.name,
                   spot.spot_type,
                   ST_X(spot.location) AS longitude,
                   ST_Y(spot.location) AS latitude,
                   spot.official,
                   spot.status,
                   spot.source_name,
                   spot.source_url,
                   (SELECT count(*)
                    FROM spot_vote vote
                    WHERE vote.vote_type = 'YES'
                      AND ((spot.target_type = 'FACILITY' AND vote.facility_id = spot.target_id)
                        OR (spot.target_type = 'USER_SPOT' AND vote.spot_id = spot.target_id))) AS yes_votes,
                   (SELECT count(*)
                    FROM spot_vote vote
                    WHERE vote.vote_type = 'NO'
                      AND ((spot.target_type = 'FACILITY' AND vote.facility_id = spot.target_id)
                        OR (spot.target_type = 'USER_SPOT' AND vote.spot_id = spot.target_id))) AS no_votes,
                   (SELECT vote.vote_type
                    FROM spot_vote vote
                    WHERE vote.user_id = :userId
                      AND ((spot.target_type = 'FACILITY' AND vote.facility_id = spot.target_id)
                        OR (spot.target_type = 'USER_SPOT' AND vote.spot_id = spot.target_id))
                    LIMIT 1) AS viewer_vote,
                   (SELECT count(*)
                    FROM spot_review review
                    WHERE review.deleted_at IS NULL
                      AND ((spot.target_type = 'FACILITY' AND review.facility_id = spot.target_id)
                        OR (spot.target_type = 'USER_SPOT' AND review.spot_id = spot.target_id))) AS review_count,
                   (SELECT count(*)
                    FROM photo
                    WHERE photo.deleted_at IS NULL
                      AND ((spot.target_type = 'FACILITY' AND photo.facility_id = spot.target_id)
                        OR (spot.target_type = 'USER_SPOT' AND photo.spot_id = spot.target_id)
                        OR photo.spot_review_id IN (
                            SELECT review.review_id
                            FROM spot_review review
                            WHERE review.deleted_at IS NULL
                              AND ((spot.target_type = 'FACILITY' AND review.facility_id = spot.target_id)
                                OR (spot.target_type = 'USER_SPOT' AND review.spot_id = spot.target_id))
                        ))) AS photo_count,
                   (SELECT photo.object_key
                    FROM photo
                    WHERE photo.deleted_at IS NULL
                      AND ((spot.target_type = 'FACILITY' AND photo.facility_id = spot.target_id)
                        OR (spot.target_type = 'USER_SPOT' AND photo.spot_id = spot.target_id)
                        OR photo.spot_review_id IN (
                            SELECT review.review_id
                            FROM spot_review review
                            WHERE review.deleted_at IS NULL
                              AND ((spot.target_type = 'FACILITY' AND review.facility_id = spot.target_id)
                                OR (spot.target_type = 'USER_SPOT' AND review.spot_id = spot.target_id))
                        ))
                    ORDER BY photo.created_at DESC, photo.photo_id DESC
                    LIMIT 1) AS representative_photo_key
            FROM community_spot spot
            """;

    private static final String SPOT_MAP_SQL = SPOT_CTE + SPOT_SELECT + """
            WHERE ST_Intersects(
                    spot.location,
                    ST_MakeEnvelope(:west, :south, :east, :north, 4326)
                  )
              AND (CAST(:spotType AS varchar) IS NULL OR spot.spot_type = CAST(:spotType AS varchar))
            ORDER BY spot.target_type, spot.target_id
            """;

    private static final String SPOT_DETAIL_SQL = SPOT_CTE + SPOT_SELECT + """
            WHERE spot.target_type = :targetType
              AND spot.target_id = :targetId
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

    private static final RowMapper<CommunitySpotQueryResult> SPOT_ROW_MAPPER = (resultSet, rowNumber) ->
            new CommunitySpotQueryResult(
                    CommunitySpotTargetType.valueOf(resultSet.getString("target_type")),
                    resultSet.getLong("target_id"),
                    resultSet.getObject("mountain_id", Long.class),
                    resultSet.getString("name"),
                    CommunitySpotType.valueOf(resultSet.getString("spot_type")),
                    resultSet.getDouble("longitude"),
                    resultSet.getDouble("latitude"),
                    resultSet.getBoolean("official"),
                    resultSet.getString("status"),
                    resultSet.getString("source_name"),
                    resultSet.getString("source_url"),
                    resultSet.getLong("yes_votes"),
                    resultSet.getLong("no_votes"),
                    enumValue(resultSet.getString("viewer_vote"), CommunityVoteType.class),
                    resultSet.getLong("review_count"),
                    resultSet.getLong("photo_count"),
                    resultSet.getString("representative_photo_key")
            );

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

    public List<CommunityMountainQueryResult> findMountains() {
        return jdbcTemplate.query("""
                SELECT mountain_id,
                       source_record_id AS external_id,
                       mountain_name,
                       ST_X(mountain_display_location) AS longitude,
                       ST_Y(mountain_display_location) AS latitude
                FROM mountain
                ORDER BY mountain_name, mountain_id
                """, (resultSet, rowNumber) -> new CommunityMountainQueryResult(
                resultSet.getLong("mountain_id"),
                resultSet.getString("external_id"),
                resultSet.getString("mountain_name"),
                resultSet.getDouble("longitude"),
                resultSet.getDouble("latitude")
        ));
    }

    public List<CommunityCoursePointQueryResult> findCoursePoints(Long mountainId) {
        return jdbcTemplate.query("""
                SELECT course.course_id,
                       course.mountain_id,
                       course.source_record_id AS external_id,
                       course.course_name,
                       COALESCE(course.official_distance_meters,
                                ST_Length(course.course_geometry::geography)) / 1000.0 AS distance_km,
                       (SELECT count(*)
                        FROM course_review review
                        WHERE review.course_id = course.course_id
                          AND review.deleted_at IS NULL) AS review_count,
                       (point).path[1] AS sequence,
                       ST_X((point).geom) AS longitude,
                       ST_Y((point).geom) AS latitude
                FROM course
                CROSS JOIN LATERAL ST_DumpPoints(course.course_geometry) point
                WHERE course.mountain_id = :mountainId
                ORDER BY course.course_id, sequence
                """, new MapSqlParameterSource("mountainId", mountainId),
                (resultSet, rowNumber) -> new CommunityCoursePointQueryResult(
                        resultSet.getLong("course_id"),
                        resultSet.getLong("mountain_id"),
                        resultSet.getString("external_id"),
                        resultSet.getString("course_name"),
                        resultSet.getDouble("distance_km"),
                        resultSet.getLong("review_count"),
                        resultSet.getInt("sequence"),
                        resultSet.getDouble("longitude"),
                        resultSet.getDouble("latitude")
                ));
    }

    public boolean existsUser(Long userId) {
        return exists("SELECT EXISTS (SELECT 1 FROM app_user WHERE user_id = :id)", userId);
    }

    public boolean existsMountain(Long mountainId) {
        return exists("SELECT EXISTS (SELECT 1 FROM mountain WHERE mountain_id = :id)", mountainId);
    }

    public boolean existsCourse(Long courseId) {
        return exists("SELECT EXISTS (SELECT 1 FROM course WHERE course_id = :id)", courseId);
    }

    public Optional<Long> findCourseMountainId(Long courseId) {
        return jdbcTemplate.query(
                "SELECT mountain_id FROM course WHERE course_id = :id",
                new MapSqlParameterSource("id", courseId),
                (resultSet, rowNumber) -> resultSet.getLong("mountain_id")
        ).stream().findFirst();
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

    public List<CommunitySpotQueryResult> findSpots(
            Long userId,
            Long mountainId,
            CommunitySpotMapRequest request
    ) {
        var parameters = spotParameters(userId, mountainId)
                .addValue("west", request.west())
                .addValue("south", request.south())
                .addValue("east", request.east())
                .addValue("north", request.north())
                .addValue("spotType", request.type() == null ? null : request.type().name());
        return jdbcTemplate.query(SPOT_MAP_SQL, parameters, SPOT_ROW_MAPPER);
    }

    public Optional<CommunitySpotQueryResult> findSpot(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        var parameters = spotParameters(userId, mountainId)
                .addValue("targetType", targetType.name())
                .addValue("targetId", targetId);
        return jdbcTemplate.query(SPOT_DETAIL_SQL, parameters, SPOT_ROW_MAPPER).stream().findFirst();
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

    private boolean exists(String sql, Long id) {
        Boolean exists = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", id), Boolean.class);
        return Boolean.TRUE.equals(exists);
    }

    private List<CommunityReviewQueryResult> findReviews(String sql, MapSqlParameterSource parameters) {
        return jdbcTemplate.query(sql, parameters, REVIEW_ROW_MAPPER);
    }

    private static MapSqlParameterSource spotParameters(Long userId, Long mountainId) {
        return new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("mountainId", mountainId);
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

    private static <E extends Enum<E>> E enumValue(String value, Class<E> enumClass) {
        return value == null ? null : Enum.valueOf(enumClass, value);
    }
}
