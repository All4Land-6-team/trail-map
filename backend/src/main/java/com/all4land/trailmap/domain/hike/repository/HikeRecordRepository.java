package com.all4land.trailmap.domain.hike.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;

@Repository
@RequiredArgsConstructor
public class HikeRecordRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

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
