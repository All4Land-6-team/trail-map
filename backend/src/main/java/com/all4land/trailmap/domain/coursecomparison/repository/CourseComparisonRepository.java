package com.all4land.trailmap.domain.coursecomparison.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class CourseComparisonRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public record CourseRow(long courseId, String courseName, int courseVersion,
                            long mountainId, String mountainName) {}

    public List<CourseRow> findCourses(List<Long> courseIds) {
        return jdbc.query("""
                SELECT c.course_id, c.course_name, c.course_version, c.mountain_id, m.mountain_name
                FROM course c JOIN mountain m ON m.mountain_id=c.mountain_id
                WHERE c.course_id IN (:ids)
                """, new MapSqlParameterSource("ids", courseIds), (rs, row) -> new CourseRow(
                rs.getLong("course_id"), rs.getString("course_name"), rs.getInt("course_version"),
                rs.getLong("mountain_id"), rs.getString("mountain_name")));
    }
}
