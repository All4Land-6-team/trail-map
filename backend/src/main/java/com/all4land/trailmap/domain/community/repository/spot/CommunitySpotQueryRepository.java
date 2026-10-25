package com.all4land.trailmap.domain.community.repository.spot;

import com.all4land.trailmap.domain.community.dto.request.CommunitySpotMapRequest;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import com.all4land.trailmap.domain.community.entity.CommunityVoteType;
import com.all4land.trailmap.domain.community.repository.result.CommunitySpotQueryResult;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class CommunitySpotQueryRepository {

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

    private final NamedParameterJdbcTemplate jdbcTemplate;

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

    private static MapSqlParameterSource spotParameters(Long userId, Long mountainId) {
        return new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("mountainId", mountainId);
    }

    private static <E extends Enum<E>> E enumValue(String value, Class<E> enumClass) {
        return value == null ? null : Enum.valueOf(enumClass, value);
    }
}
