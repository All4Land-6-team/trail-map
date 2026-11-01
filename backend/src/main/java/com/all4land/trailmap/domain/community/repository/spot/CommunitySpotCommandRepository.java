package com.all4land.trailmap.domain.community.repository.spot;

import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import com.all4land.trailmap.domain.community.repository.result.CommunitySpotDuplicateQueryResult;
import com.all4land.trailmap.domain.community.repository.result.CommunityVoteTargetQueryResult;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class CommunitySpotCommandRepository {

    private static final double DUPLICATE_RADIUS_METERS = 50.0;

    private static final String DUPLICATE_SQL = """
            WITH candidate AS (
                SELECT 'FACILITY' AS target_type,
                       facility.facility_id AS target_id,
                       COALESCE(facility.facility_name, '이름 없는 시설') AS name,
                       CASE UPPER(facility.facility_type)
                           WHEN 'REST_AREA' THEN 'REST_AREA'
                           WHEN 'SHELTER' THEN 'REST_AREA'
                           WHEN 'DRINKING_FOUNTAIN' THEN 'DRINKING_FOUNTAIN'
                           WHEN 'DRINKING_WATER' THEN 'DRINKING_FOUNTAIN'
                           WHEN 'WATER' THEN 'DRINKING_FOUNTAIN'
                           WHEN 'SPRING' THEN 'DRINKING_FOUNTAIN'
                           WHEN 'RESTROOM' THEN 'RESTROOM'
                           WHEN 'TOILET' THEN 'RESTROOM'
                           WHEN 'PHOTO_SPOT' THEN 'PHOTO_SPOT'
                           WHEN 'VIEWPOINT' THEN 'PHOTO_SPOT'
                           ELSE 'OTHER'
                       END AS spot_type,
                       facility.facility_location AS location,
                       COALESCE(facility.official_status, 'OFFICIAL') AS status
                FROM facility
                WHERE facility.mountain_id = :mountainId

                UNION ALL

                SELECT 'USER_SPOT' AS target_type,
                       spot.spot_id AS target_id,
                       COALESCE(spot.spot_name, '이름 없는 스팟') AS name,
                       spot.spot_type,
                       spot.spot_location AS location,
                       spot.spot_status AS status
                FROM user_spot spot
                WHERE spot.mountain_id = :mountainId
                  AND spot.deleted_at IS NULL
                  AND spot.spot_status <> 'HIDDEN'
            ), request_point AS (
                SELECT ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326) AS location
            )
            SELECT candidate.target_type,
                   candidate.target_id,
                   candidate.name,
                   candidate.spot_type,
                   ST_X(candidate.location) AS longitude,
                   ST_Y(candidate.location) AS latitude,
                   ST_Distance(candidate.location::geography, request_point.location::geography) AS distance_meters,
                   candidate.status
            FROM candidate
            CROSS JOIN request_point
            WHERE candidate.spot_type = :spotType
              AND ST_DWithin(
                    candidate.location::geography,
                    request_point.location::geography,
                    :radiusMeters
                  )
            ORDER BY distance_meters, candidate.target_type, candidate.target_id
            """;

    private static final String INSERT_SQL = """
            INSERT INTO user_spot (
                user_id, mountain_id, hike_record_id, spot_type, spot_location, spot_name, spot_status
            ) VALUES (
                :userId,
                :mountainId,
                :hikeRecordId,
                :spotType,
                ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
                :name,
                'PENDING'
            )
            RETURNING spot_id
            """;

    private static final RowMapper<CommunitySpotDuplicateQueryResult> DUPLICATE_ROW_MAPPER =
            (resultSet, rowNumber) -> new CommunitySpotDuplicateQueryResult(
                    CommunitySpotTargetType.valueOf(resultSet.getString("target_type")),
                    resultSet.getLong("target_id"),
                    resultSet.getString("name"),
                    CommunitySpotType.valueOf(resultSet.getString("spot_type")),
                    resultSet.getDouble("longitude"),
                    resultSet.getDouble("latitude"),
                    resultSet.getDouble("distance_meters"),
                    resultSet.getString("status")
            );

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public Optional<CommunityVoteTargetQueryResult> lockVoteTarget(
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        String sql = switch (targetType) {
            case FACILITY -> """
                    SELECT 'FACILITY' AS target_type,
                           facility_id AS target_id,
                           COALESCE(official_status, 'OFFICIAL') AS status
                    FROM facility
                    WHERE mountain_id = :mountainId
                      AND facility_id = :targetId
                    FOR UPDATE
                    """;
            case USER_SPOT -> """
                    SELECT 'USER_SPOT' AS target_type,
                           spot_id AS target_id,
                           spot_status AS status
                    FROM user_spot
                    WHERE mountain_id = :mountainId
                      AND spot_id = :targetId
                      AND deleted_at IS NULL
                    FOR UPDATE
                    """;
        };
        var parameters = new MapSqlParameterSource()
                .addValue("mountainId", mountainId)
                .addValue("targetId", targetId);
        return jdbcTemplate.query(sql, parameters, (resultSet, rowNumber) -> new CommunityVoteTargetQueryResult(
                CommunitySpotTargetType.valueOf(resultSet.getString("target_type")),
                resultSet.getLong("target_id"),
                resultSet.getString("status")
        )).stream().findFirst();
    }

    public String updateUserSpotVisibility(Long spotId, long noVotes) {
        return jdbcTemplate.queryForObject("""
                UPDATE user_spot
                SET spot_status = CASE
                        WHEN :noVotes >= 3 THEN 'HIDDEN'
                        WHEN spot_status = 'HIDDEN' THEN 'RECONFIRMATION_REQUIRED'
                        ELSE spot_status
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE spot_id = :spotId
                RETURNING spot_status
                """, new MapSqlParameterSource()
                .addValue("spotId", spotId)
                .addValue("noVotes", noVotes), String.class);
    }

    public List<CommunitySpotDuplicateQueryResult> findDuplicates(
            Long mountainId,
            CommunitySpotType type,
            double longitude,
            double latitude
    ) {
        var parameters = spotParameters(mountainId, type, longitude, latitude)
                .addValue("radiusMeters", DUPLICATE_RADIUS_METERS);
        return jdbcTemplate.query(DUPLICATE_SQL, parameters, DUPLICATE_ROW_MAPPER);
    }

    public Long insert(
            Long userId,
            Long mountainId,
            Long hikeRecordId,
            CommunitySpotType type,
            String name,
            double longitude,
            double latitude
    ) {
        var parameters = spotParameters(mountainId, type, longitude, latitude)
                .addValue("userId", userId)
                .addValue("hikeRecordId", hikeRecordId)
                .addValue("name", name);
        return jdbcTemplate.queryForObject(INSERT_SQL, parameters, Long.class);
    }

    private static MapSqlParameterSource spotParameters(
            Long mountainId,
            CommunitySpotType type,
            double longitude,
            double latitude
    ) {
        return new MapSqlParameterSource()
                .addValue("mountainId", mountainId)
                .addValue("spotType", type.name())
                .addValue("longitude", longitude)
                .addValue("latitude", latitude);
    }
}
