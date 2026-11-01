package com.all4land.trailmap.domain.courseroute.repository;

import com.all4land.trailmap.domain.courseroute.dto.response.CourseRouteResponse;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteDocumentReader.Route;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class CourseRouteRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private static final String SELECT = """
            SELECT c.course_id, c.mountain_id, c.course_name, c.course_version,
                   c.official_distance_meters, c.official_duration_seconds, c.course_difficulty,
                   ST_Length(c.course_geometry::geography) AS distance_meters,
                   ST_AsGeoJSON(c.course_geometry, 9) AS geometry,
                   COALESCE(r.mountain_key, m.source_record_id, m.mountain_id::text) AS mountain_key,
                   COALESCE(r.route_label, c.course_name) AS route_label,
                   COALESCE(r.validation_status, 'UNKNOWN') AS validation_status,
                   COALESCE(r.check_note, '') AS check_note,
                   s.source_name, s.provider_name, s.source_url, s.source_version, c.source_record_id,
                   g.official_course_id, g.route_label AS guide_route_label, g.difficulty_grade,
                   g.source_url AS guide_source_url, g.checked_on
            FROM course c JOIN mountain m ON m.mountain_id = c.mountain_id
            JOIN data_source s ON s.source_id = c.source_id
            LEFT JOIN course_route_metadata r ON r.course_id = c.course_id
            LEFT JOIN course_guide_metadata g ON g.course_id = c.course_id AND g.course_version = c.course_version
                AND g.route_source_hash = c.source_hash AND g.distance_meters = c.official_distance_meters
                AND g.duration_seconds = c.official_duration_seconds
                AND c.course_difficulty = CASE g.difficulty_grade WHEN '하' THEN 'BEGINNER' WHEN '중' THEN 'INTERMEDIATE' WHEN '상' THEN 'EXPERT' END
            """;

    public List<CourseRouteResponse> findCatalog(String mountainKey) {
        return jdbc.query(SELECT + " WHERE r.mountain_key = ? ORDER BY r.route_order, c.course_id", this::map, mountainKey);
    }

    public Optional<CourseRouteResponse> find(long courseId) {
        return jdbc.query(SELECT + " WHERE c.course_id = ?", this::map, courseId).stream().findFirst();
    }

    private CourseRouteResponse map(ResultSet rs, int row) throws SQLException {
        try {
            var geometry = mapper.readTree(rs.getString("geometry"));
            var coordinates = new ArrayList<List<Double>>();
            for (var point : geometry.path("coordinates")) coordinates.add(List.of(point.get(0).doubleValue(), point.get(1).doubleValue()));
            return new CourseRouteResponse(rs.getLong("course_id"), rs.getLong("mountain_id"), rs.getString("mountain_key"),
                    rs.getString("course_name"), rs.getInt("course_version"), rs.getString("route_label"),
                    rs.getDouble("distance_meters"), rs.getObject("official_distance_meters", Double.class),
                    rs.getObject("official_duration_seconds", Integer.class), rs.getString("course_difficulty"),
                    new CourseRouteResponse.Geometry("LineString", List.copyOf(coordinates)),
                    new CourseRouteResponse.Source(rs.getString("source_name"), rs.getString("provider_name"),
                            rs.getString("source_url"), rs.getString("source_version"), rs.getString("source_record_id"),
                            rs.getString("validation_status"), rs.getString("check_note")),
                    rs.getString("official_course_id") == null ? null : new CourseRouteResponse.Guide(
                            rs.getString("official_course_id"), rs.getString("guide_route_label"), rs.getString("difficulty_grade"),
                            rs.getString("guide_source_url"), rs.getString("checked_on")));
        } catch (JsonProcessingException exception) { throw new SQLException("Invalid stored route geometry", exception); }
    }

    public record Dataset(String hash, long bukhansanId, long dobongsanId, long sourceId) {}

    /** Serializes concurrent import transactions without changing any existing course. */
    public void lockImport() {
        jdbc.execute("SELECT pg_advisory_xact_lock(950013)");
    }

    public Optional<Dataset> findDataset(String key) {
        return jdbc.query("""
                SELECT file_hash, bukhansan_mountain_id, dobongsan_mountain_id, source_id
                FROM course_route_dataset WHERE dataset_key = ?
                """, (rs, row) -> new Dataset(rs.getString(1), rs.getLong(2), rs.getLong(3), rs.getLong(4)), key)
                .stream().findFirst();
    }

    public boolean mountainsExist(long bukhansanId, long dobongsanId) {
        return jdbc.queryForObject("SELECT count(*) FROM mountain WHERE mountain_id IN (?, ?)",
                Integer.class, bukhansanId, dobongsanId) == 2;
    }

    public long insertDataset(String key, String hash, long bukhansanId, long dobongsanId) {
        Long sourceId = jdbc.queryForObject("""
                INSERT INTO data_source (source_name, provider_name, source_url, source_format, source_crs, source_version)
                VALUES ('북한산국립공원 13개 재구성 후보 코스', '사용자 제공 재구성 데이터 (공식 원본 아님)',
                        'https://www.knps.or.kr/front/portal/visit/visitCourseSubMain.do?menuNo=7020092&parkId=121500&parkNavGb=guide',
                        'GEOJSON', 'EPSG:4326', ?) RETURNING source_id
                """, Long.class, hash);
        jdbc.update("""
                INSERT INTO course_route_dataset (dataset_key, source_id, file_hash, bukhansan_mountain_id, dobongsan_mountain_id)
                VALUES (?, ?, ?, ?, ?)
                """, key, sourceId, hash, bukhansanId, dobongsanId);
        return sourceId;
    }

    public void insertRoute(String datasetKey, long sourceId, long mountainId, Route route) {
        Long courseId = jdbc.queryForObject("""
                INSERT INTO course (mountain_id, course_name, course_geometry, official_distance_meters,
                                    source_id, source_record_id, source_hash, imported_at)
                VALUES (?, ?, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326), ?, ?, ?, ?, CURRENT_TIMESTAMP)
                RETURNING course_id
                """, Long.class, mountainId, route.name(), route.geometry(), route.officialMeters(),
                sourceId, route.recordId(), route.hash());
        jdbc.update("""
                INSERT INTO course_route_metadata (course_id, dataset_key, source_record_id, mountain_key,
                                                   route_order, route_label, validation_status, check_note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, courseId, datasetKey, route.recordId(), route.mountainKey(), route.order(), route.via(), route.status(), route.note());
    }

    /** A replay also detects a modified/missing imported course; never silently repairs it. */
    public boolean matchesStored(long sourceId, long mountainId, Route route) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM course c JOIN course_route_metadata r ON r.course_id = c.course_id
                WHERE c.source_id = ? AND c.source_record_id = ? AND c.source_hash = ? AND c.mountain_id = ?
                  AND c.course_version = 1 AND c.course_name = ?
                  AND ((c.course_difficulty IS NULL AND c.official_duration_seconds IS NULL) OR EXISTS (
                      SELECT 1 FROM course_guide_metadata g WHERE g.course_id = c.course_id
                      AND g.course_version = c.course_version AND g.route_source_hash = c.source_hash
                      AND g.distance_meters = c.official_distance_meters AND g.duration_seconds = c.official_duration_seconds
                      AND c.course_difficulty = CASE g.difficulty_grade WHEN '하' THEN 'BEGINNER' WHEN '중' THEN 'INTERMEDIATE' WHEN '상' THEN 'EXPERT' END))
                  AND c.official_distance_meters IS NOT DISTINCT FROM ?
                  AND ST_AsEWKB(c.course_geometry) = ST_AsEWKB(ST_SetSRID(ST_GeomFromGeoJSON(?), 4326))
                  AND r.source_record_id = ? AND r.mountain_key = ? AND r.route_order = ?
                  AND r.route_label = ? AND r.validation_status = ? AND r.check_note = ?)
                """, Boolean.class, sourceId, route.recordId(), route.hash(), mountainId, route.name(), route.officialMeters(),
                route.geometry(), route.recordId(), route.mountainKey(), route.order(), route.via(), route.status(), route.note()));
    }
}
