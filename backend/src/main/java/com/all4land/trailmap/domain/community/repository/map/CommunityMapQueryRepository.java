package com.all4land.trailmap.domain.community.repository.map;

import com.all4land.trailmap.domain.community.repository.result.CommunityCoursePointQueryResult;
import com.all4land.trailmap.domain.community.repository.result.CommunityMountainQueryResult;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class CommunityMapQueryRepository {

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
                       (SELECT count(*)
                        FROM photo
                        JOIN course_review review ON review.review_id = photo.course_review_id
                        WHERE review.course_id = course.course_id
                          AND review.deleted_at IS NULL
                          AND photo.deleted_at IS NULL) AS photo_count,
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
                        resultSet.getLong("photo_count"),
                        resultSet.getInt("sequence"),
                        resultSet.getDouble("longitude"),
                        resultSet.getDouble("latitude")
                ));
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

    private boolean exists(String sql, Long id) {
        Boolean exists = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", id), Boolean.class);
        return Boolean.TRUE.equals(exists);
    }
}
