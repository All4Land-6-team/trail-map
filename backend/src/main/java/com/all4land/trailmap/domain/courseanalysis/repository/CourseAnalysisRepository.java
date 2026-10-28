package com.all4land.trailmap.domain.courseanalysis.repository;

import com.all4land.trailmap.domain.courseanalysis.dto.request.CourseAnalysisDocument;
import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse.Metrics;
import com.all4land.trailmap.domain.courseanalysis.entity.AnalysisQualityStatus;
import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** 경로 스냅샷을 포함한 공간 적재·조회 SQL을 담당한다. */
@Repository
@RequiredArgsConstructor
public class CourseAnalysisRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public record CourseRow(long courseId, long mountainId, int courseVersion, long sourceId,
                            boolean geometryMatches) {}

    public record AnalysisRow(long analysisId, long courseId, long mountainId, int currentCourseVersion,
                              long currentSourceId, int courseVersion, long demSourceId, String algorithmVersion,
                              String sourceType, AnalysisQualityStatus qualityStatus, OffsetDateTime calculatedAt,
                              Metrics metrics, boolean versionCurrent, boolean geometryCurrent, String snapshotGeometry) {}

    private static final String SELECT_ANALYSIS = """
            SELECT a.*, c.mountain_id, c.course_version AS current_course_version,
                   c.source_id AS current_source_id,
                   a.course_version = c.course_version AS version_current,
                   ST_AsGeoJSON(a.analyzed_course_geometry, 9)::jsonb =
                       ST_AsGeoJSON(c.course_geometry, 9)::jsonb AS geometry_current,
                   ST_AsGeoJSON(a.analyzed_course_geometry, 15) AS snapshot_geometry
            FROM course_analysis a JOIN course c ON c.course_id = a.course_id
            """;

    private static final RowMapper<AnalysisRow> ANALYSIS_MAPPER = (rs, number) -> new AnalysisRow(
            rs.getLong("analysis_id"), rs.getLong("course_id"), rs.getLong("mountain_id"),
            rs.getInt("current_course_version"), rs.getLong("current_source_id"), rs.getInt("course_version"),
            rs.getLong("dem_source_id"), rs.getString("algorithm_version"), rs.getString("source_type"),
            AnalysisQualityStatus.valueOf(rs.getString("quality_status")),
            rs.getObject("calculated_at", OffsetDateTime.class),
            new Metrics(rs.getObject("distance_meters", Double.class),
                    rs.getObject("estimated_duration_seconds", Integer.class),
                    rs.getObject("min_elevation_meters", Double.class), rs.getObject("max_elevation_meters", Double.class),
                    rs.getObject("elevation_gain_meters", Double.class), rs.getObject("elevation_loss_meters", Double.class),
                    rs.getObject("steep_section_ratio_percent", Double.class)),
            rs.getBoolean("version_current"), rs.getBoolean("geometry_current"), rs.getString("snapshot_geometry"));

    public Optional<CourseRow> findCourse(long courseId) {
        return jdbc.query("SELECT course_id, mountain_id, course_version, source_id FROM course WHERE course_id=:id",
                new MapSqlParameterSource("id", courseId), (rs, row) -> new CourseRow(rs.getLong("course_id"),
                        rs.getLong("mountain_id"), rs.getInt("course_version"), rs.getLong("source_id"), true))
                .stream().findFirst();
    }

    public Optional<CourseRow> lockCourse(long courseId, String geometry) {
        // GeoJSON 기본 정밀도(소수 9자리)에 맞춰 방향과 꼭짓점 순서까지 비교한다.
        return jdbc.query("""
                SELECT course_id, mountain_id, course_version, source_id,
                       ST_AsGeoJSON(course_geometry,9)::jsonb =
                       ST_AsGeoJSON(ST_SetSRID(ST_GeomFromGeoJSON(:geometry),4326),9)::jsonb AS geometry_matches
                FROM course WHERE course_id=:id FOR UPDATE
                """, new MapSqlParameterSource("id", courseId).addValue("geometry", geometry),
                (rs, row) -> new CourseRow(rs.getLong("course_id"), rs.getLong("mountain_id"),
                        rs.getInt("course_version"), rs.getLong("source_id"), rs.getBoolean("geometry_matches")))
                .stream().findFirst();
    }

    public long findOrCreateDemSource(String name, String provider, String version, String crs) {
        // data_source에 UNIQUE가 없으므로 이 적재기의 DEM 출처 생성만 직렬화한다.
        jdbc.getJdbcTemplate().execute("SELECT pg_advisory_xact_lock(1953653098)");
        var params = new MapSqlParameterSource("name", name).addValue("provider", provider)
                .addValue("version", version).addValue("crs", crs);
        List<java.util.Map<String, Object>> sources = jdbc.queryForList("""
                SELECT source_id, source_crs FROM data_source
                WHERE source_name=:name AND provider_name IS NOT DISTINCT FROM :provider
                  AND source_format='GEOTIFF' AND source_version=:version
                """, params);
        if (sources.size() > 1 || sources.size() == 1 && !crs.equals(sources.getFirst().get("source_crs"))) {
            throw new CourseAnalysisException(CourseAnalysisErrorCode.SOURCE_CONFLICT);
        }
        if (!sources.isEmpty()) return ((Number) sources.getFirst().get("source_id")).longValue();
        return jdbc.queryForObject("""
                INSERT INTO data_source(source_name,provider_name,source_format,source_crs,source_version)
                VALUES (:name,:provider,'GEOTIFF',:crs,:version) RETURNING source_id
                """, params, Long.class);
    }

    public Optional<AnalysisRow> findExisting(long courseId, int version, long demSourceId, String algorithm) {
        return jdbc.query(SELECT_ANALYSIS + """
                 WHERE a.course_id=:course AND a.course_version=:version
                   AND a.dem_source_id=:dem AND a.algorithm_version=:algorithm
                """, new MapSqlParameterSource("course", courseId).addValue("version", version)
                .addValue("dem", demSourceId).addValue("algorithm", algorithm), ANALYSIS_MAPPER).stream().findFirst();
    }

    public Optional<AnalysisRow> findLatest(long courseId) {
        return jdbc.query(SELECT_ANALYSIS + """
                 WHERE a.course_id=:id
                 ORDER BY (a.course_version=c.course_version AND
                     ST_AsGeoJSON(a.analyzed_course_geometry,9)::jsonb=ST_AsGeoJSON(c.course_geometry,9)::jsonb) DESC,
                     a.calculated_at DESC NULLS LAST, a.analysis_id DESC LIMIT 1
                """, new MapSqlParameterSource("id", courseId), ANALYSIS_MAPPER).stream().findFirst();
    }

    public Optional<AnalysisRow> findById(long analysisId) {
        return jdbc.query(SELECT_ANALYSIS + " WHERE a.analysis_id=:id",
                new MapSqlParameterSource("id", analysisId), ANALYSIS_MAPPER).stream().findFirst();
    }

    public long insert(CourseAnalysisDocument document, long demSourceId, String geometry) {
        var summary = document.summary();
        var params = new MapSqlParameterSource("course", document.course().courseId())
                .addValue("version", document.course().courseVersion()).addValue("dem", demSourceId)
                .addValue("algorithm", document.algorithmVersion()).addValue("geometry", geometry)
                .addValue("distance", summary.distanceMeters()).addValue("minimum", summary.minElevationMeters())
                .addValue("maximum", summary.maxElevationMeters()).addValue("gain", summary.elevationGainMeters())
                .addValue("loss", summary.elevationLossMeters()).addValue("quality", document.qualityStatus().name())
                .addValue("calculated", document.calculatedAt());
        return jdbc.queryForObject("""
                INSERT INTO course_analysis(course_id,course_version,dem_source_id,algorithm_version,
                    analyzed_course_geometry,source_type,distance_meters,min_elevation_meters,max_elevation_meters,
                    elevation_gain_meters,elevation_loss_meters,quality_status,calculated_at)
                VALUES (:course,:version,:dem,:algorithm,ST_SetSRID(ST_GeomFromGeoJSON(:geometry),4326),
                    'SERVICE_CALCULATED',:distance,:minimum,:maximum,:gain,:loss,:quality,:calculated)
                RETURNING analysis_id
                """, params, Long.class);
    }
}
