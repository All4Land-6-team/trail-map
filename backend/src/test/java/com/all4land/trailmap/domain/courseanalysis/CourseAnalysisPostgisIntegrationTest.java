package com.all4land.trailmap.domain.courseanalysis;

import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisImportService;
import com.all4land.trailmap.domain.courseanalysis.storage.CourseAnalysisFileStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.*;
import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 명시적으로 지정한 개발용 PostGIS만 사용하며 테스트 행과 프로필 파일은 모두 롤백한다. */
@SpringBootTest(properties = {
        "spring.datasource.url=${ANALYSIS_TEST_JDBC_URL}",
        "spring.datasource.username=${ANALYSIS_TEST_DB_USERNAME:postgres}",
        "spring.datasource.password=${ANALYSIS_TEST_DB_PASSWORD:${DB_PASSWORD:}}"
})
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "ANALYSIS_TEST_JDBC_URL", matches = "jdbc:postgresql:.*")
class CourseAnalysisPostgisIntegrationTest {
    private static final Path STORE = temporaryStore();
    @Autowired CourseAnalysisImportService importer;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired MockMvc mvc;
    @MockitoSpyBean CourseAnalysisFileStore store;
    @TempDir Path inputDirectory;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("course-analysis.root-path", STORE::toString);
        registry.add("terrain.root-path", () -> STORE.toUri().toString());
    }

    @Test
    void importsOnceAndQueriesTheMatchingSummaryAndProfile() {
        rollback(fixture -> {
            var first = importer.importFile(fixture.file(), fixture.name(), "test-only");
            var again = importer.importFile(fixture.file(), fixture.name(), "test-only");
            assertThat(first.inserted()).isTrue(); assertThat(again.inserted()).isFalse();
            assertThat(again.analysisId()).isEqualTo(first.analysisId());
            fixture.document().put("calculated_at", "2026-10-29T00:00:00Z");
            section(section(fixture.document(), "inputs"), "course").put("path", "C:\\relocated\\course.geojson");
            var repeatedRun = importer.importFile(write(inputDirectory, mapper, fixture.document()), fixture.name(), "test-only");
            assertThat(repeatedRun.analysisId()).isEqualTo(first.analysisId());
            assertThat(repeatedRun.inserted()).isFalse();
            assertThat(first.demSourceId()).isNotEqualTo(fixture.sourceId());
            assertThat(count(fixture.courseId())).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT ST_SRID(analyzed_course_geometry) FROM course_analysis WHERE analysis_id=?",
                    Integer.class, first.analysisId())).isEqualTo(4326);
            mvc.perform(get("/v1/courses/" + fixture.courseId() + "/analysis"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.analysisId").value(first.analysisId()))
                    .andExpect(jsonPath("$.data.qualityStatus").value("AVAILABLE"))
                    .andExpect(jsonPath("$.data.metrics.elevationGainMeters").value(10))
                    .andExpect(jsonPath("$.data.metrics.estimatedDurationSeconds").value(nullValue()));
            mvc.perform(get("/v1/course-analyses/" + first.analysisId() + "/profile"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.samples.length()").value(3))
                    .andExpect(jsonPath("$.data.samples[0].slopePercent").value(nullValue()))
                    .andExpect(jsonPath("$.data.samples[2].slopePercent").value(-50))
                    .andExpect(jsonPath("$.data.analysis.sourceKind").value("development"))
                    .andExpect(jsonPath("$.data.analysis.inputs").doesNotExist());
        });
    }

    @Test
    void changedConfigurationForTheSameUniqueKeyCannotOverwrite() {
        rollback(fixture -> {
            var first = importer.importFile(fixture.file(), fixture.name(), "test-only");
            byte[] old = Files.readAllBytes(STORE.resolve(first.analysisId() + ".json"));
            section(fixture.document(), "settings").put("sampling_method", "nearest");
            Path different = write(inputDirectory, mapper, fixture.document());
            assertThatThrownBy(() -> importer.importFile(different, fixture.name(), "test-only"))
                    .isInstanceOfSatisfying(CourseAnalysisException.class,
                            error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.RESULT_CONFLICT));
            assertThat(Files.readAllBytes(STORE.resolve(first.analysisId() + ".json"))).isEqualTo(old);
            assertThat(count(fixture.courseId())).isEqualTo(1);
        });
    }

    @Test
    void rejectsMismatchedVersionsAndOrderedGeometryBeforeWriting() {
        rollback(fixture -> {
            section(fixture.document(), "course").put("course_version", 2);
            Path badVersion = write(inputDirectory, mapper, fixture.document());
            assertThatThrownBy(() -> importer.importFile(badVersion, fixture.name(), null))
                    .isInstanceOfSatisfying(CourseAnalysisException.class,
                            error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.COURSE_CHANGED));
            section(fixture.document(), "course").put("course_version", 1);
            var geometry = section(section(fixture.document(), "course"), "geometry");
            geometry.set("coordinates", mapper.readTree("[[10.0,10.0],[10.0001,10.0001],[10.0002,10.0]]"));
            Path badGeometry = write(inputDirectory, mapper, fixture.document());
            assertThatThrownBy(() -> importer.importFile(badGeometry, fixture.name(), null))
                    .isInstanceOfSatisfying(CourseAnalysisException.class,
                            error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.COURSE_CHANGED));
            assertThat(count(fixture.courseId())).isZero();
        });
    }

    @Test
    void changedVersionAndDirectionAreOutdatedAndPreserveTheSnapshot() {
        rollback(fixture -> {
            var imported = importer.importFile(fixture.file(), fixture.name(), null);
            jdbc.update("UPDATE course SET course_version=2,course_geometry=ST_Reverse(course_geometry) WHERE course_id=?",
                    fixture.courseId());
            mvc.perform(get("/v1/courses/" + fixture.courseId() + "/analysis"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.qualityStatus").value("OUTDATED"))
                    .andExpect(jsonPath("$.data.recordedQualityStatus").value("AVAILABLE"))
                    .andExpect(jsonPath("$.data.currentCourseVersion").value(2))
                    .andExpect(jsonPath("$.data.analyzedCourseVersion").value(1));
            mvc.perform(get("/v1/course-analyses/" + imported.analysisId() + "/profile"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.analysis.qualityStatus").value("OUTDATED"))
                    .andExpect(jsonPath("$.data.samples[0].coordinate[0]").value(10.0));
        });
    }

    @Test
    void currentVersionWinsOverANewerTimestampFromAnOldVersion() {
        rollback(fixture -> {
            importer.importFile(fixture.file(), fixture.name(), null);
            jdbc.update("UPDATE course SET course_version=2 WHERE course_id=?", fixture.courseId());
            section(fixture.document(), "course").put("course_version", 2);
            fixture.document().put("calculated_at", "2020-01-01T00:00:00Z");
            var current = importer.importFile(write(inputDirectory, mapper, fixture.document()), fixture.name(), null);
            mvc.perform(get("/v1/courses/" + fixture.courseId() + "/analysis"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.analysisId").value(current.analysisId()))
                    .andExpect(jsonPath("$.data.qualityStatus").value("AVAILABLE"));
        });
    }

    @Test
    void rollbackRemovesBothInsertedRowsAndThePublishedArtifact() {
        AtomicLong analysisId = new AtomicLong(); AtomicLong courseId = new AtomicLong(); AtomicLong demId = new AtomicLong();
        rollback(fixture -> {
            var result = importer.importFile(fixture.file(), fixture.name(), null);
            analysisId.set(result.analysisId()); courseId.set(fixture.courseId()); demId.set(result.demSourceId());
            assertThat(STORE.resolve(result.analysisId() + ".json")).exists();
        });
        assertThat(count(courseId.get())).isZero();
        assertThat(STORE.resolve(analysisId.get() + ".json")).doesNotExist();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM data_source WHERE source_id=?", Integer.class, demId.get())).isZero();
    }

    @Test
    void publicationFailureDoesNotLeaveDbRows() {
        AtomicLong courseId = new AtomicLong();
        doThrow(new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE)).when(store).publish(any());
        rollback(fixture -> {
            courseId.set(fixture.courseId());
            assertThatThrownBy(() -> importer.importFile(fixture.file(), fixture.name(), null))
                    .isInstanceOf(CourseAnalysisException.class);
        });
        assertThat(count(courseId.get())).isZero();
    }

    @Test
    void missingArtifactAndAlteredDbSummaryAreUnavailable() {
        rollback(fixture -> {
            var result = importer.importFile(fixture.file(), fixture.name(), null);
            jdbc.update("UPDATE course_analysis SET distance_meters=21 WHERE analysis_id=?", result.analysisId());
            mvc.perform(get("/v1/courses/" + fixture.courseId() + "/analysis"))
                    .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("ANALYSIS_503_1"));
            jdbc.update("UPDATE course_analysis SET distance_meters=20 WHERE analysis_id=?", result.analysisId());
            Files.delete(STORE.resolve(result.analysisId() + ".json"));
            mvc.perform(get("/v1/course-analyses/" + result.analysisId() + "/profile"))
                    .andExpect(status().isServiceUnavailable());
        });
    }

    @Test
    void noAnalysisAndUnknownIdentifiersHaveDifferentResponses() {
        rollback(fixture -> {
            mvc.perform(get("/v1/courses/" + fixture.courseId() + "/analysis"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.qualityStatus").value("NO_DATA"))
                    .andExpect(jsonPath("$.data.metrics.distanceMeters").value(nullValue()));
            mvc.perform(get("/v1/courses/" + Long.MAX_VALUE + "/analysis")).andExpect(status().isNotFound());
            mvc.perform(get("/v1/courses/0/analysis")).andExpect(status().isBadRequest());
            mvc.perform(get("/v1/course-analyses/" + Long.MAX_VALUE + "/profile")).andExpect(status().isNotFound());
        });
    }

    private record Fixture(long courseId, long sourceId, String name, ObjectNode document, Path file) {}
    @FunctionalInterface private interface Check { void run(Fixture fixture) throws Exception; }

    private void rollback(Check check) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            try {
                String name = "analysis-test-" + UUID.randomUUID();
                long source = jdbc.queryForObject("INSERT INTO data_source(source_name,source_format) VALUES (?,'TEST') RETURNING source_id",
                        Long.class, name);
                long mountain = jdbc.queryForObject("""
                        INSERT INTO mountain(mountain_name,mountain_display_location,source_id,source_hash,imported_at)
                        VALUES ('test',ST_SetSRID(ST_MakePoint(10,10),4326),?, ?,now()) RETURNING mountain_id
                        """, Long.class, source, "a".repeat(64));
                long course = jdbc.queryForObject("""
                        INSERT INTO course(mountain_id,course_name,course_geometry,source_id,source_hash,imported_at)
                        VALUES (?,'test',ST_GeomFromText('LINESTRING(10 10,10.0002 10)',4326),?, ?,now()) RETURNING course_id
                        """, Long.class, mountain, source, "b".repeat(64));
                var root = document(mapper);
                section(root, "course").put("course_id", course).put("mountain_id", mountain).put("source_id", source);
                check.run(new Fixture(course, source, name, root, write(inputDirectory, mapper, root)));
            } catch (RuntimeException | Error exception) {
                throw exception;
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            } finally {
                status.setRollbackOnly();
            }
        });
    }

    private int count(long courseId) {
        return jdbc.queryForObject("SELECT count(*) FROM course_analysis WHERE course_id=?", Integer.class, courseId);
    }

    private static Path temporaryStore() {
        try { return Files.createTempDirectory("analysis-postgis-test-"); }
        catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
    }

    @AfterAll
    static void removeStore() throws IOException {
        try (var paths = Files.walk(STORE)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }
}
