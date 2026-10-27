package com.all4land.trailmap.domain.hike.repository;

import com.all4land.trailmap.domain.hike.entity.HikeRecordStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class HikeRecordRepository {

    private static final String RECORD_SELECT_SQL = """
            SELECT hike_record_id, schedule_id, course_id, hike_status, started_at, ended_at,
                   traveled_distance_meters, actual_duration_seconds,
                   ST_X(ST_EndPoint(traveled_path)) AS last_longitude,
                   ST_Y(ST_EndPoint(traveled_path)) AS last_latitude
            FROM hike_record
            """;

    private static final RowMapper<HikeRecordRow> RECORD_ROW_MAPPER = (resultSet, rowNumber) -> new HikeRecordRow(
            resultSet.getLong("hike_record_id"),
            resultSet.getLong("schedule_id"),
            resultSet.getLong("course_id"),
            HikeRecordStatus.valueOf(resultSet.getString("hike_status")),
            resultSet.getObject("started_at", OffsetDateTime.class),
            resultSet.getObject("ended_at", OffsetDateTime.class),
            resultSet.getObject("traveled_distance_meters", Double.class),
            resultSet.getObject("actual_duration_seconds", Integer.class),
            resultSet.getObject("last_longitude", Double.class),
            resultSet.getObject("last_latitude", Double.class)
    );

    private final NamedParameterJdbcTemplate jdbcTemplate;

    /** 일정의 코스 번호·버전·경로를 그대로 복사해 진행 중 기록을 만든다. 이후 코스가 바뀌어도 기록은 덮어쓰지 않는다. */
    public Long start(Long userId, Long scheduleId, OffsetDateTime startedAt) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO hike_record
                    (schedule_id, user_id, course_id, course_version, recorded_course_geometry, started_at, hike_status)
                SELECT schedule.schedule_id,
                       schedule.user_id,
                       schedule.course_id,
                       course.course_version,
                       course.course_geometry,
                       :startedAt,
                       'IN_PROGRESS'
                FROM hike_schedule schedule
                JOIN course ON course.course_id = schedule.course_id
                WHERE schedule.schedule_id = :scheduleId
                  AND schedule.user_id = :userId
                  AND schedule.deleted_at IS NULL
                RETURNING hike_record_id
                """, new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("scheduleId", scheduleId)
                .addValue("startedAt", startedAt), Long.class);
    }

    public boolean existsBySchedule(Long scheduleId) {
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM hike_record WHERE schedule_id = :scheduleId)",
                new MapSqlParameterSource("scheduleId", scheduleId),
                Boolean.class
        );
        return Boolean.TRUE.equals(exists);
    }

    public Optional<HikeRecordRow> findOwned(Long userId, Long hikeRecordId) {
        return jdbcTemplate.query(RECORD_SELECT_SQL + """
                        WHERE hike_record_id = :hikeRecordId AND user_id = :userId AND deleted_at IS NULL
                        """, new MapSqlParameterSource()
                        .addValue("userId", userId)
                        .addValue("hikeRecordId", hikeRecordId), RECORD_ROW_MAPPER)
                .stream().findFirst();
    }

    /** 사용자의 진행 중(등산 중·하산 중) 기록. uq_hike_record_active_user로 최대 1개다. */
    public Optional<HikeRecordRow> findActive(Long userId) {
        return jdbcTemplate.query(RECORD_SELECT_SQL + """
                        WHERE user_id = :userId AND deleted_at IS NULL AND hike_status IN ('IN_PROGRESS', 'DESCENDING')
                        """, new MapSqlParameterSource("userId", userId), RECORD_ROW_MAPPER)
                .stream().findFirst();
    }

    /** 이동 경로 좌표 [경도, 위도] 목록. 위치를 받지 않았으면 빈 목록이다. */
    public List<List<Double>> findTraveledPath(Long hikeRecordId) {
        return jdbcTemplate.query("""
                        SELECT ST_X(point.geom) AS longitude, ST_Y(point.geom) AS latitude
                        FROM hike_record, ST_DumpPoints(traveled_path) AS point
                        WHERE hike_record_id = :hikeRecordId
                        ORDER BY point.path
                        """, new MapSqlParameterSource("hikeRecordId", hikeRecordId),
                (resultSet, rowNumber) -> List.of(resultSet.getDouble("longitude"), resultSet.getDouble("latitude")));
    }

    /**
     * 이동 경로 뒤에 선분을 이어 붙이고 이동 거리를 경로 길이(구면 거리)로 갱신한다.
     * 경로가 비어 있으면 그 선분이 경로가 된다. 이어 붙인 지점의 중복 점은 지운다.
     */
    public void appendPath(Long hikeRecordId, String lineStringWkt, OffsetDateTime updatedAt) {
        jdbcTemplate.update("""
                UPDATE hike_record record
                SET traveled_path = next.path,
                    traveled_distance_meters = ST_Length(next.path::geography),
                    updated_at = :updatedAt
                FROM (
                    SELECT ST_RemoveRepeatedPoints(
                               CASE WHEN traveled_path IS NULL THEN ST_GeomFromText(:line, 4326)
                                    ELSE ST_MakeLine(traveled_path, ST_GeomFromText(:line, 4326)) END
                           ) AS path
                    FROM hike_record
                    WHERE hike_record_id = :hikeRecordId
                ) next
                WHERE record.hike_record_id = :hikeRecordId
                """, new MapSqlParameterSource()
                .addValue("hikeRecordId", hikeRecordId)
                .addValue("line", lineStringWkt)
                .addValue("updatedAt", updatedAt));
    }

    public void descend(Long hikeRecordId, OffsetDateTime updatedAt) {
        jdbcTemplate.update("""
                UPDATE hike_record
                SET hike_status = 'DESCENDING', updated_at = :updatedAt
                WHERE hike_record_id = :hikeRecordId AND hike_status = 'IN_PROGRESS'
                """, new MapSqlParameterSource()
                .addValue("hikeRecordId", hikeRecordId)
                .addValue("updatedAt", updatedAt));
    }

    /** 진행 중인 기록을 종료한다. 소요 시간은 종료-시작 경과 초, 이동 거리는 최종 경로 길이로 남긴다. */
    public void finish(Long hikeRecordId, OffsetDateTime endedAt) {
        jdbcTemplate.update("""
                UPDATE hike_record
                SET hike_status = 'COMPLETED',
                    ended_at = :endedAt,
                    actual_duration_seconds = EXTRACT(EPOCH FROM (:endedAt - started_at))::integer,
                    traveled_distance_meters = ST_Length(traveled_path::geography),
                    updated_at = :endedAt
                WHERE hike_record_id = :hikeRecordId AND hike_status IN ('IN_PROGRESS', 'DESCENDING')
                """, new MapSqlParameterSource()
                .addValue("hikeRecordId", hikeRecordId)
                .addValue("endedAt", endedAt));
    }

    public HikeRecordCompletion complete(Long userId, Long scheduleId, OffsetDateTime endedAt) {
        var parameters = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("scheduleId", scheduleId)
                .addValue("endedAt", endedAt);
        jdbcTemplate.update("""
                INSERT INTO hike_record
                    (schedule_id, user_id, course_id, course_version, recorded_course_geometry,
                     started_at, ended_at, hike_status, actual_duration_seconds)
                SELECT schedule.schedule_id,
                       schedule.user_id,
                       schedule.course_id,
                       course.course_version,
                       course.course_geometry,
                       LEAST(schedule.scheduled_starts_at, :endedAt),
                       :endedAt,
                       'COMPLETED',
                       EXTRACT(EPOCH FROM (:endedAt - LEAST(schedule.scheduled_starts_at, :endedAt)))::integer
                FROM hike_schedule schedule
                JOIN course ON course.course_id = schedule.course_id
                WHERE schedule.schedule_id = :scheduleId
                  AND schedule.user_id = :userId
                  AND schedule.deleted_at IS NULL
                ON CONFLICT (schedule_id) DO NOTHING
                """, parameters);
        return jdbcTemplate.queryForObject("""
                SELECT hike_record_id, schedule_id, course_id, ended_at
                FROM hike_record
                WHERE schedule_id = :scheduleId AND user_id = :userId AND deleted_at IS NULL
                """, parameters, (resultSet, rowNumber) -> new HikeRecordCompletion(
                resultSet.getLong("hike_record_id"),
                resultSet.getLong("schedule_id"),
                resultSet.getLong("course_id"),
                resultSet.getObject("ended_at", OffsetDateTime.class)
        ));
    }
}
