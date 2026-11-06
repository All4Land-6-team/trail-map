package com.all4land.trailmap.domain.parkcontrol.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository @RequiredArgsConstructor
public class ControlCourseRepository {
    private final JdbcTemplate jdbc;
    public record Scope(long courseId, String mountainKey) {}
    public Optional<Scope> findScope(long courseId) {
        return jdbc.query("""
            SELECT c.course_id, r.mountain_key FROM course c
            LEFT JOIN course_route_metadata r ON r.course_id = c.course_id WHERE c.course_id = ?
            """, (rs, i) -> new Scope(rs.getLong(1), rs.getString(2)), courseId).stream().findFirst();
    }
}
