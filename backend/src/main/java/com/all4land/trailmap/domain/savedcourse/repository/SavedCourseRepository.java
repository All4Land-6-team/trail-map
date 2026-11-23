package com.all4land.trailmap.domain.savedcourse.repository;

import com.all4land.trailmap.domain.savedcourse.dto.SavedCourseResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** 등산 담기(saved_course). 빼면 지우지 않고 deleted_at을 남긴다. 한 사용자가 같은 코스를 두 번 담을 수 없다(uq_saved_course_active). */
@Repository
@RequiredArgsConstructor
public class SavedCourseRepository {

    private static final String ACTIVE_SQL = """
            SELECT saved.course_id, course.mountain_id, route.mountain_key, saved.saved_at
            FROM saved_course saved
            JOIN course ON course.course_id = saved.course_id
            LEFT JOIN course_route_metadata route ON route.course_id = saved.course_id
            WHERE saved.user_id = :userId AND saved.deleted_at IS NULL
            """;

    private static final RowMapper<SavedCourseResponse> ROW_MAPPER = (rs, rowNumber) -> new SavedCourseResponse(
            rs.getLong("course_id"),
            rs.getLong("mountain_id"),
            rs.getString("mountain_key"),
            rs.getObject("saved_at", OffsetDateTime.class)
    );

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public boolean existsUser(Long userId) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM app_user WHERE user_id = :userId)",
                new MapSqlParameterSource("userId", userId), Boolean.class));
    }

    public boolean existsCourse(Long courseId) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM course WHERE course_id = :courseId)",
                new MapSqlParameterSource("courseId", courseId), Boolean.class));
    }

    /** 담은 순서(먼저 담은 것부터). */
    public List<SavedCourseResponse> findActive(Long userId) {
        return jdbcTemplate.query(ACTIVE_SQL + " ORDER BY saved.saved_at, saved.saved_course_id",
                new MapSqlParameterSource("userId", userId), ROW_MAPPER);
    }

    public Optional<SavedCourseResponse> findActive(Long userId, Long courseId) {
        return jdbcTemplate.query(ACTIVE_SQL + " AND saved.course_id = :courseId",
                new MapSqlParameterSource("userId", userId).addValue("courseId", courseId), ROW_MAPPER)
                .stream().findFirst();
    }

    /** 이미 담겨 있으면 아무것도 하지 않는다(다시 눌러도, 동시에 눌러도 1건). */
    public void save(Long userId, Long courseId) {
        jdbcTemplate.update("""
                INSERT INTO saved_course (user_id, course_id)
                VALUES (:userId, :courseId)
                ON CONFLICT (user_id, course_id) WHERE deleted_at IS NULL DO NOTHING
                """, new MapSqlParameterSource("userId", userId).addValue("courseId", courseId));
    }

    public void remove(Long userId, Long courseId) {
        jdbcTemplate.update("""
                UPDATE saved_course
                SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = :userId AND course_id = :courseId AND deleted_at IS NULL
                """, new MapSqlParameterSource("userId", userId).addValue("courseId", courseId));
    }
}
