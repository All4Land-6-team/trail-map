package com.all4land.trailmap.domain.facility.repository;

import com.all4land.trailmap.domain.facility.dto.response.FacilityResponse;
import com.all4land.trailmap.domain.facility.entity.FacilityType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class FacilityRepository {
    private static final String COLUMNS = """
            f.facility_id, f.mountain_id, f.facility_name, f.facility_type,
            ST_X(f.facility_location) AS longitude, ST_Y(f.facility_location) AS latitude,
            f.official_status, f.source_record_id, f.source_date, f.imported_at,
            s.source_id, s.source_name, s.provider_name, s.source_url,
            s.source_format, s.source_crs, s.source_version
            """;
    private static final String FROM = " FROM facility f JOIN data_source s ON s.source_id = f.source_id ";
    private static final RowMapper<FacilityResponse> ROW_MAPPER = (rs, rowNumber) -> new FacilityResponse(
            rs.getLong("facility_id"), rs.getObject("mountain_id", Long.class),
            rs.getString("facility_name"), FacilityType.valueOf(rs.getString("facility_type")),
            rs.getDouble("longitude"), rs.getDouble("latitude"), rs.getString("official_status"),
            rs.getString("source_record_id"), rs.getObject("source_date", LocalDate.class),
            rs.getObject("imported_at", OffsetDateTime.class), rs.getObject("distance_meters", Double.class),
            new FacilityResponse.Source(rs.getLong("source_id"), rs.getString("source_name"),
                    rs.getString("provider_name"), rs.getString("source_url"), rs.getString("source_format"),
                    rs.getString("source_crs"), rs.getString("source_version"))
    );
    private final NamedParameterJdbcTemplate jdbc;

    public boolean existsCourse(long courseId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM course WHERE course_id = :id)",
                new MapSqlParameterSource("id", courseId), Boolean.class));
    }

    public boolean existsSource(long sourceId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM data_source WHERE source_id = :id)",
                new MapSqlParameterSource("id", sourceId), Boolean.class));
    }

    public Optional<FacilityResponse> findById(long facilityId) {
        return jdbc.query("SELECT " + COLUMNS + ", NULL::double precision AS distance_meters" + FROM
                        + " WHERE f.facility_id = :id", new MapSqlParameterSource("id", facilityId), ROW_MAPPER)
                .stream().findFirst();
    }

    public List<FacilityResponse> findBySource(long sourceId, FacilityType type) {
        return jdbc.query("SELECT " + COLUMNS + ", NULL::double precision AS distance_meters" + FROM
                        + " WHERE f.source_id = :id" + typeClause(type) + " ORDER BY f.facility_id",
                new MapSqlParameterSource("id", sourceId).addValue("type", type == null ? null : type.name()), ROW_MAPPER);
    }

    public List<FacilityResponse> findNearCourse(long courseId, double radiusMeters, FacilityType type) {
        // geography 연산의 단위는 m이다. 코스 전체 LineString까지의 최단 거리를 사용한다.
        String sql = "SELECT " + COLUMNS + """
                , ST_Distance(f.facility_location::geography, c.course_geometry::geography) AS distance_meters
                """ + FROM + """
                JOIN course c ON c.course_id = :courseId
                WHERE ST_DWithin(f.facility_location::geography, c.course_geometry::geography, :radius)
                """ + typeClause(type) + " ORDER BY distance_meters, f.facility_id";
        return jdbc.query(sql, new MapSqlParameterSource("courseId", courseId)
                .addValue("radius", radiusMeters).addValue("type", type == null ? null : type.name()), ROW_MAPPER);
    }

    private static String typeClause(FacilityType type) {
        return type == null ? "" : " AND f.facility_type = :type";
    }
}
