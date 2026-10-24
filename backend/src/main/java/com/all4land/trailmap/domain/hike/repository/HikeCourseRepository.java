package com.all4land.trailmap.domain.hike.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/** 일정 화면에 필요한 코스·산 정보와 사용자 존재 여부를 조회한다. */
@Repository
@RequiredArgsConstructor
public class HikeCourseRepository {

    private static final String COURSE_SUMMARY_SQL = """
            SELECT course.course_id,
                   course.course_name,
                   mountain.mountain_id,
                   mountain.mountain_name,
                   course.official_distance_meters,
                   course.official_duration_seconds
            FROM course
            JOIN mountain ON mountain.mountain_id = course.mountain_id
            WHERE course.course_id IN (:courseIds)
            """;

    private static final RowMapper<HikeCourseSummary> COURSE_SUMMARY_ROW_MAPPER = (resultSet, rowNumber) ->
            new HikeCourseSummary(
                    resultSet.getLong("course_id"),
                    resultSet.getString("course_name"),
                    resultSet.getLong("mountain_id"),
                    resultSet.getString("mountain_name"),
                    resultSet.getObject("official_distance_meters", Double.class),
                    resultSet.getObject("official_duration_seconds", Integer.class)
            );

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public boolean existsUser(Long userId) {
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM app_user WHERE user_id = :userId)",
                new MapSqlParameterSource("userId", userId),
                Boolean.class
        );
        return Boolean.TRUE.equals(exists);
    }

    public Optional<HikeCourseSummary> findCourseSummary(Long courseId) {
        return findCourseSummaries(List.of(courseId)).values().stream().findFirst();
    }

    public Map<Long, HikeCourseSummary> findCourseSummaries(Collection<Long> courseIds) {
        if (courseIds.isEmpty()) {
            return Map.of();
        }
        return jdbcTemplate.query(
                        COURSE_SUMMARY_SQL,
                        new MapSqlParameterSource("courseIds", courseIds),
                        COURSE_SUMMARY_ROW_MAPPER
                ).stream()
                .collect(Collectors.toMap(HikeCourseSummary::courseId, Function.identity()));
    }
}
