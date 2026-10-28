package com.all4land.trailmap.domain.coursecomparison;

import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisImportService;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.*;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 명시적으로 지정한 개발 DB에 합성 코스만 넣고 행·프로필 파일을 모두 롤백한다. */
@SpringBootTest(properties = {
        "spring.datasource.url=${ANALYSIS_TEST_JDBC_URL}",
        "spring.datasource.username=${ANALYSIS_TEST_DB_USERNAME:postgres}",
        "spring.datasource.password=${ANALYSIS_TEST_DB_PASSWORD:${DB_PASSWORD:}}"
})
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "ANALYSIS_TEST_JDBC_URL", matches = "jdbc:postgresql:.*")
class CourseComparisonPostgisIntegrationTest {
    private static final Path STORE = temporaryStore();
    @Autowired CourseAnalysisImportService importer;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired MockMvc mvc;
    @TempDir Path inputDirectory;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("course-analysis.root-path", STORE::toString);
        registry.add("terrain.root-path", () -> STORE.toUri().toString());
    }

    @Test
    void comparesThreeCoursesInRequestOrderWithIndependentQualityStates() {
        rollback(fixture -> {
            long first = fixture.courseIds().getFirst(), second = fixture.courseIds().get(1), third = fixture.courseIds().getLast();
            var partial = input(fixture, first);
            partial.put("quality_status", "PARTIAL"); partial.withArray("quality_reasons").add("UNVERIFIED_VERTICAL_REFERENCE");
            section(partial, "settings").put("elevation_unit_source", "caller_declaration").putNull("vertical_reference");
            var firstResult = importer.importFile(write(inputDirectory, mapper, partial), fixture.name(), null);
            var thirdResult = importer.importFile(write(inputDirectory, mapper, input(fixture, third)), fixture.name(), null);
            jdbc.update("UPDATE course SET course_version=2,course_name='변경한 코스' WHERE course_id=?", third);

            mvc.perform(get("/v1/course-comparisons").param("courseIds", third + "," + first + "," + second))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.mountainId").value(fixture.mountainId()))
                    .andExpect(jsonPath("$.data.courses.length()").value(3))
                    .andExpect(jsonPath("$.data.courses[0].courseId").value(third))
                    .andExpect(jsonPath("$.data.courses[0].courseName").value("변경한 코스"))
                    .andExpect(jsonPath("$.data.courses[0].currentCourseVersion").value(2))
                    .andExpect(jsonPath("$.data.courses[0].analysis.analyzedCourseVersion").value(1))
                    .andExpect(jsonPath("$.data.courses[0].analysis.qualityStatus").value("OUTDATED"))
                    .andExpect(jsonPath("$.data.courses[0].analysis.analysisId").value(thirdResult.analysisId()))
                    .andExpect(jsonPath("$.data.courses[1].courseId").value(first))
                    .andExpect(jsonPath("$.data.courses[1].analysis.qualityStatus").value("PARTIAL"))
                    .andExpect(jsonPath("$.data.courses[1].analysis.sourceKind").value("development"))
                    .andExpect(jsonPath("$.data.courses[1].analysis.settings.elevationUnitSource").value("caller_declaration"))
                    .andExpect(jsonPath("$.data.courses[1].analysis.settings.verticalReference").value(nullValue()))
                    .andExpect(jsonPath("$.data.courses[1].analysis.profileUrl")
                            .value("/api/v1/course-analyses/" + firstResult.analysisId() + "/profile"))
                    .andExpect(jsonPath("$.data.courses[2].courseId").value(second))
                    .andExpect(jsonPath("$.data.courses[2].analysis.qualityStatus").value("NO_DATA"))
                    .andExpect(jsonPath("$.data.courses[2].analysis.metrics.distanceMeters").value(nullValue()));
        });
    }

    @Test
    void batchSelectsOneCurrentAnalysisPerCourseRatherThanOneGlobalLatestRow() {
        rollback(fixture -> {
            long first = fixture.courseIds().getFirst(), second = fixture.courseIds().get(1);
            importer.importFile(write(inputDirectory, mapper, input(fixture, first)), fixture.name(), null);
            jdbc.update("UPDATE course SET course_version=2 WHERE course_id=?", first);
            var current = input(fixture, first);
            section(current, "course").put("course_version", 2);
            current.put("calculated_at", "2020-01-01T00:00:00Z");
            var firstResult = importer.importFile(write(inputDirectory, mapper, current), fixture.name(), null);
            var secondResult = importer.importFile(write(inputDirectory, mapper, input(fixture, second)), fixture.name(), null);

            mvc.perform(get("/v1/course-comparisons").param("courseIds", second + "," + first))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.courses[0].analysis.analysisId").value(secondResult.analysisId()))
                    .andExpect(jsonPath("$.data.courses[1].analysis.analysisId").value(firstResult.analysisId()))
                    .andExpect(jsonPath("$.data.courses[1].analysis.analyzedCourseVersion").value(2))
                    .andExpect(jsonPath("$.data.courses[1].analysis.qualityStatus").value("AVAILABLE"));
        });
    }

    @Test
    void geometryChangesMarkOnlyThatCourseOutdatedEvenWithoutAVersionChange() {
        rollback(fixture -> {
            long first = fixture.courseIds().getFirst(), second = fixture.courseIds().get(1);
            importer.importFile(write(inputDirectory, mapper, input(fixture, first)), fixture.name(), null);
            importer.importFile(write(inputDirectory, mapper, input(fixture, second)), fixture.name(), null);
            jdbc.update("UPDATE course SET course_geometry=ST_Reverse(course_geometry) WHERE course_id=?", first);
            mvc.perform(get("/v1/course-comparisons").param("courseIds", first + "," + second))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.courses[0].analysis.qualityStatus").value("OUTDATED"))
                    .andExpect(jsonPath("$.data.courses[0].analysis.qualityReasons[0]").value("COURSE_GEOMETRY_CHANGED"))
                    .andExpect(jsonPath("$.data.courses[1].analysis.qualityStatus").value("AVAILABLE"));
        });
    }

    @Test
    void noAnalysisKeepsNullMeasurementsEvenWhenOfficialCourseNumbersExist() {
        rollback(fixture -> {
            long first = fixture.courseIds().getFirst(), second = fixture.courseIds().get(1);
            jdbc.update("UPDATE course SET official_distance_meters=4200,official_duration_seconds=3600 WHERE course_id=?", first);
            mvc.perform(get("/v1/course-comparisons").param("courseIds", first + "," + second))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.courses.length()").value(2))
                    .andExpect(jsonPath("$.data.courses[0].analysis.qualityStatus").value("NO_DATA"))
                    .andExpect(jsonPath("$.data.courses[0].analysis.metrics.distanceMeters").value(nullValue()))
                    .andExpect(jsonPath("$.data.courses[0].analysis.metrics.estimatedDurationSeconds").value(nullValue()))
                    .andExpect(jsonPath("$.data.courses[0].analysis.profileUrl").value(nullValue()))
                    .andExpect(jsonPath("$.data.courses[1].analysis.qualityStatus").value("NO_DATA"));
        });
    }

    @Test
    void differentMountainsAndMissingCoursesRejectTheWholeComparison() {
        rollback(fixture -> {
            long first = fixture.courseIds().getFirst();
            mvc.perform(get("/v1/course-comparisons").param("courseIds", first + "," + fixture.otherCourseId()))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMPARISON_400_2"));
            mvc.perform(get("/v1/course-comparisons").param("courseIds", first + "," + Long.MAX_VALUE))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("COMPARISON_404_1"));
        });
    }

    @Test
    void missingArtifactFailsInsteadOfReturningAMisleadingPartialSuccess() {
        rollback(fixture -> {
            long first = fixture.courseIds().getFirst(), second = fixture.courseIds().get(1);
            var imported = importer.importFile(write(inputDirectory, mapper, input(fixture, first)), fixture.name(), null);
            Files.delete(STORE.resolve(imported.analysisId() + ".json"));
            mvc.perform(get("/v1/course-comparisons").param("courseIds", first + "," + second))
                    .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.code").value("ANALYSIS_503_1"));
        });
    }

    private ObjectNode input(Fixture fixture, long courseId) {
        var root = document(mapper);
        section(root, "course").put("course_id", courseId).put("mountain_id", fixture.mountainId())
                .put("source_id", fixture.sourceId());
        return root;
    }

    private record Fixture(long sourceId, long mountainId, List<Long> courseIds, long otherCourseId, String name) {}
    @FunctionalInterface private interface Check { void run(Fixture fixture) throws Exception; }

    private void rollback(Check check) {
        var transaction = new TransactionTemplate(transactionManager);
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
        transaction.executeWithoutResult(status -> {
            try {
                String name = "comparison-test-" + UUID.randomUUID();
                long source = jdbc.queryForObject("INSERT INTO data_source(source_name,source_format) VALUES (?,'TEST') RETURNING source_id",
                        Long.class, name);
                long mountain = mountain(source), otherMountain = mountain(source);
                var courses = new ArrayList<Long>();
                for (int index = 1; index <= 3; index++) courses.add(course(mountain, source, "코스 " + index));
                check.run(new Fixture(source, mountain, courses, course(otherMountain, source, "다른 산 코스"), name));
            } catch (RuntimeException | Error exception) {
                throw exception;
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            } finally {
                status.setRollbackOnly();
            }
        });
    }

    private long mountain(long source) {
        return jdbc.queryForObject("""
                INSERT INTO mountain(mountain_name,mountain_display_location,source_id,source_hash,imported_at)
                VALUES ('합성 테스트 산',ST_SetSRID(ST_MakePoint(10,10),4326),?, ?,now()) RETURNING mountain_id
                """, Long.class, source, UUID.randomUUID().toString().replace("-", "").repeat(2));
    }

    private long course(long mountain, long source, String name) {
        return jdbc.queryForObject("""
                INSERT INTO course(mountain_id,course_name,course_geometry,source_id,source_hash,imported_at)
                VALUES (?, ?,ST_GeomFromText('LINESTRING(10 10,10.0002 10)',4326),?, ?,now()) RETURNING course_id
                """, Long.class, mountain, name, source, UUID.randomUUID().toString().replace("-", "").repeat(2));
    }

    private static Path temporaryStore() {
        try { return Files.createTempDirectory("comparison-postgis-test-"); }
        catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
    }

    @AfterAll
    static void removeStore() throws IOException {
        try (var paths = Files.walk(STORE)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }
}
