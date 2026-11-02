package com.all4land.trailmap.domain.courseanalysis;

import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisDocumentRepository;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisImportService;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisService;
import com.all4land.trailmap.domain.courseanalysis.storage.CourseAnalysisDatabaseStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.*;
import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 별도 개발용 PostGIS에만 실행한다. 합성 행은 롤백하거나 개별 ID로 정리한다. */
@SpringBootTest(properties = {
        "course-analysis.storage=database",
        "spring.datasource.url=${ANALYSIS_TEST_JDBC_URL}",
        "spring.datasource.username=${ANALYSIS_TEST_DB_USERNAME:postgres}",
        "spring.datasource.password=${ANALYSIS_TEST_DB_PASSWORD:${DB_PASSWORD:}}"
})
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "ANALYSIS_TEST_JDBC_URL", matches = "jdbc:postgresql:.*")
class CourseAnalysisDatabasePostgisIntegrationTest {
    @Autowired CourseAnalysisImportService importer;
    @Autowired CourseAnalysisDocumentReader reader;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired Environment environment;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired MockMvc mvc;
    @MockitoSpyBean CourseAnalysisDatabaseStore store;
    @TempDir Path inputDirectory;

    @Test
    void committedDocumentCanBeReadThroughAnIndependentDataSourceAndBackend() throws Exception {
        var fixture = transaction().execute(status -> fixture());
        try {
            var result = importer.importFile(fixture.file(), fixture.name(), "test-only");
            var otherDataSource = new DriverManagerDataSource(
                    environment.getRequiredProperty("spring.datasource.url"),
                    environment.getRequiredProperty("spring.datasource.username"),
                    environment.getRequiredProperty("spring.datasource.password"));
            var otherJdbc = new NamedParameterJdbcTemplate(otherDataSource);
            var otherReader = new CourseAnalysisDocumentReader(mapper());
            var otherStore = new CourseAnalysisDatabaseStore(new CourseAnalysisDocumentRepository(otherJdbc), otherReader);
            var otherBackend = new CourseAnalysisService(new CourseAnalysisRepository(otherJdbc), otherStore, otherReader);
            var summary = otherBackend.getSummary(fixture.courseId());
            var profile = otherBackend.getProfile(result.analysisId());
            assertThat(summary.analysisId()).isEqualTo(result.analysisId());
            assertThat(summary.profileUrl()).isEqualTo("/api/v1/course-analyses/" + result.analysisId() + "/profile");
            assertThat(profile.samples()).hasSize(3);
            assertThat(profile.samples().get(2).slopePercent()).isEqualTo(-50.0);
            assertThat(jdbc.queryForObject("SELECT analysis_document->>'formatVersion' FROM course_analysis WHERE analysis_id=?",
                    String.class, result.analysisId())).isEqualTo("1");
            mvc.perform(get("/v1/course-analyses/" + result.analysisId() + "/profile"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.analysis.inputs").doesNotExist())
                    .andExpect(jsonPath("$.data.analysis.metrics.estimatedDurationSeconds").value(nullValue()));
        } finally {
            transaction().executeWithoutResult(status -> {
                jdbc.update("DELETE FROM course_analysis WHERE course_id=?", fixture.courseId());
                jdbc.update("DELETE FROM course WHERE course_id=?", fixture.courseId());
                jdbc.update("DELETE FROM mountain WHERE mountain_id=?", fixture.mountainId());
                jdbc.update("DELETE FROM data_source WHERE source_id=? OR source_name=?", fixture.sourceId(), fixture.name());
            });
        }
    }

    @Test
    void jsonbRoundTripPreservesSignedZeroAndTheExistingDocumentHash() {
        rollback(fixture -> {
            section(section(fixture.document(), "inputs"), "dem").put("band_offset", -0.0);
            Path file = write(inputDirectory, mapper, fixture.document());
            var result = importer.importFile(file, fixture.name(), null);
            var stored = store.load(result.analysisId());
            assertThat(stored.documentHash()).isEqualTo(reader.read(file).hash());
            assertThat(Double.doubleToRawLongBits(stored.document().inputs().dem().bandOffset()))
                    .isEqualTo(Double.doubleToRawLongBits(-0.0));
            mvc.perform(get("/v1/course-analyses/" + result.analysisId() + "/profile"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.samples.length()").value(3));
        });
    }

    @Test
    void repeatedImportsAreIdempotentAndConflictsCannotOverwriteTheDocument() {
        rollback(fixture -> {
            var first = importer.importFile(fixture.file(), fixture.name(), null);
            String original = payload(first.analysisId());
            assertThatThrownBy(() -> store.publish(store.load(first.analysisId())))
                    .isInstanceOf(CourseAnalysisException.class);
            fixture.document().put("calculated_at", "2026-11-02T00:00:00Z");
            section(section(fixture.document(), "inputs"), "course").put("path", "/another-computer/course.geojson");
            var again = importer.importFile(write(inputDirectory, mapper, fixture.document()), fixture.name(), null);
            assertThat(again.analysisId()).isEqualTo(first.analysisId());
            assertThat(again.inserted()).isFalse();
            section(fixture.document(), "settings").put("sampling_method", "nearest");
            assertThatThrownBy(() -> importer.importFile(write(inputDirectory, mapper, fixture.document()), fixture.name(), null))
                    .isInstanceOfSatisfying(CourseAnalysisException.class,
                            error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.RESULT_CONFLICT));
            assertThat(payload(first.analysisId())).isEqualTo(original);
        });
    }

    @Test
    void rollbackRemovesSummaryDocumentAndNewDemSourceTogether() {
        AtomicLong id = new AtomicLong(); AtomicLong demId = new AtomicLong();
        rollback(fixture -> {
            var result = importer.importFile(fixture.file(), fixture.name(), null);
            id.set(result.analysisId()); demId.set(result.demSourceId());
            assertThat(payload(id.get())).isNotBlank();
        });
        assertRemoved(id.get(), demId.get());
    }

    @Test
    void failureAfterPublishingTheDocumentRollsBackTheWholeImport() {
        AtomicLong id = new AtomicLong(); AtomicLong demId = new AtomicLong();
        doAnswer(invocation -> {
            var stored = invocation.getArgument(0, CourseAnalysisDocumentReader.Stored.class);
            id.set(stored.analysisId()); demId.set(stored.demSourceId());
            invocation.callRealMethod();
            throw new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE);
        }).when(store).publish(any());
        rollback(fixture -> assertThatThrownBy(() -> importer.importFile(fixture.file(), fixture.name(), null))
                .isInstanceOf(CourseAnalysisException.class));
        assertThat(id.get()).isPositive();
        assertRemoved(id.get(), demId.get());
    }

    @Test
    void comparisonAndProfileKeepPartialNoDataAndOutdatedStates() {
        rollback(fixture -> {
            fixture.document().put("quality_status", "PARTIAL");
            fixture.document().withArray("quality_reasons").add("UNVERIFIED_VERTICAL_REFERENCE");
            section(fixture.document(), "settings").putNull("vertical_reference");
            var result = importer.importFile(write(inputDirectory, mapper, fixture.document()), fixture.name(), null);
            long otherCourse = insertCourse(fixture.mountainId(), fixture.sourceId());
            mvc.perform(get("/v1/course-comparisons").param("courseIds", otherCourse + "," + fixture.courseId()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.courses[0].courseId").value(otherCourse))
                    .andExpect(jsonPath("$.data.courses[0].analysis.qualityStatus").value("NO_DATA"))
                    .andExpect(jsonPath("$.data.courses[0].analysis.profileUrl").value(nullValue()))
                    .andExpect(jsonPath("$.data.courses[1].analysis.qualityStatus").value("PARTIAL"))
                    .andExpect(jsonPath("$.data.courses[1].analysis.qualityReasons[0]").value("UNVERIFIED_VERTICAL_REFERENCE"));
            jdbc.update("UPDATE course SET course_version=2 WHERE course_id=?", fixture.courseId());
            mvc.perform(get("/v1/course-analyses/" + result.analysisId() + "/profile"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.analysis.qualityStatus").value("OUTDATED"))
                    .andExpect(jsonPath("$.data.analysis.recordedQualityStatus").value("PARTIAL"))
                    .andExpect(jsonPath("$.data.samples[2].slopePercent").value(-50));
        });
    }

    @Test
    void assumedAnalysisSurvivesDbReadsAndLaterConfirmationWithoutOverwritingTheOriginal() {
        rollback(fixture -> {
            var root = fixture.document();
            section(root, "course").put("source_kind", "unknown");
            section(section(root, "inputs"), "dem").putNull("band_unit");
            section(root, "settings").put("elevation_unit_source", "assumed").putNull("vertical_reference");
            root.put("quality_status", "PARTIAL");
            root.withArray("quality_reasons").add("ASSUMED_ELEVATION_UNIT").add("UNVERIFIED_VERTICAL_REFERENCE");
            var file = write(inputDirectory, mapper, root);
            var assumed = importer.importFile(file, fixture.name(), null);
            String original = payload(assumed.analysisId());
            var again = importer.importFile(file, fixture.name(), null);
            assertThat(again.analysisId()).isEqualTo(assumed.analysisId());
            assertThat(again.inserted()).isFalse();
            long otherCourse = insertCourse(fixture.mountainId(), fixture.sourceId());
            mvc.perform(get("/v1/courses/" + fixture.courseId() + "/analysis"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.qualityStatus").value("PARTIAL"))
                    .andExpect(jsonPath("$.data.settings.elevationUnitSource").value("assumed"))
                    .andExpect(jsonPath("$.data.qualityReasons[0]").value("ASSUMED_ELEVATION_UNIT"))
                    .andExpect(jsonPath("$.data.sourceKind").value("unknown"));
            mvc.perform(get("/v1/course-comparisons").param("courseIds", fixture.courseId() + "," + otherCourse))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.courses[0].analysis.settings.elevationUnitSource").value("assumed"))
                    .andExpect(jsonPath("$.data.courses[0].analysis.metrics.elevationGainMeters").value(10));

            section(root, "settings").put("elevation_unit_source", "caller_declaration");
            root.withArray("quality_reasons").removeAll().add("UNVERIFIED_VERTICAL_REFERENCE");
            root.put("calculated_at", "2026-11-03T00:00:00Z");
            var confirmed = importer.importFile(write(inputDirectory, mapper, root), fixture.name(), null);
            assertThat(confirmed.analysisId()).isNotEqualTo(assumed.analysisId());
            assertThat(confirmed.demSourceId()).isNotEqualTo(assumed.demSourceId());
            assertThat(payload(assumed.analysisId())).isEqualTo(original);
            mvc.perform(get("/v1/courses/" + fixture.courseId() + "/analysis"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.analysisId").value(confirmed.analysisId()))
                    .andExpect(jsonPath("$.data.settings.elevationUnitSource").value("caller_declaration"));
            mvc.perform(get("/v1/course-analyses/" + assumed.analysisId() + "/profile"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.analysis.settings.elevationUnitSource").value("assumed"))
                    .andExpect(jsonPath("$.data.analysis.qualityReasons[0]").value("ASSUMED_ELEVATION_UNIT"))
                    .andExpect(jsonPath("$.data.samples[2].slopePercent").value(-50));
            jdbc.update("UPDATE course SET course_version=2 WHERE course_id=?", fixture.courseId());
            mvc.perform(get("/v1/course-analyses/" + assumed.analysisId() + "/profile"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.analysis.qualityStatus").value("OUTDATED"))
                    .andExpect(jsonPath("$.data.analysis.recordedQualityStatus").value("PARTIAL"))
                    .andExpect(jsonPath("$.data.analysis.settings.elevationUnitSource").value("assumed"));
        });
    }

    @Test
    void missingAndTamperedDbDocumentsReturnTheExistingUnavailableResponse() {
        rollback(fixture -> {
            var result = importer.importFile(fixture.file(), fixture.name(), null);
            // Existing file-backed rows also have NULL here; database mode reports them as unavailable.
            jdbc.update("UPDATE course_analysis SET analysis_document=NULL WHERE analysis_id=?", result.analysisId());
            mvc.perform(get("/v1/courses/" + fixture.courseId() + "/analysis"))
                    .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("ANALYSIS_503_1"));
            var valid = reader.read(fixture.file());
            store.publish(new CourseAnalysisDocumentReader.Stored(result.analysisId(), result.demSourceId(), valid.hash(), valid.document()));
            jdbc.update("""
                    UPDATE course_analysis SET analysis_document=jsonb_set(analysis_document,'{payload}',
                        to_jsonb(replace(analysis_document->>'payload','course-dem-v1','tampered'))) WHERE analysis_id=?
                    """, result.analysisId());
            mvc.perform(get("/v1/course-analyses/" + result.analysisId() + "/profile"))
                    .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("ANALYSIS_503_1"));
        });
    }

    @Test
    void migrationRejectsMissingOrMismatchedEnvelopeIdentity() {
        for (int attempt = 0; attempt < 3; attempt++) {
            int variant = attempt;
            rollback(fixture -> {
                var result = importer.importFile(fixture.file(), fixture.name(), null);
                String value = switch (variant) {
                    case 0 -> "{}";
                    case 1 -> "{\"formatVersion\":1}";
                    default -> jdbc.queryForObject("""
                            SELECT jsonb_set(analysis_document,'{analysisId}','0')::text
                            FROM course_analysis WHERE analysis_id=?
                            """, String.class, result.analysisId());
                };
                assertThatThrownBy(() -> jdbc.update("UPDATE course_analysis SET analysis_document=CAST(? AS jsonb) WHERE analysis_id=?",
                        value, result.analysisId())).isInstanceOf(DataIntegrityViolationException.class)
                        .hasMessageContaining("chk_course_analysis_document");
            });
        }
    }

    private record Fixture(long courseId, long mountainId, long sourceId, String name, ObjectNode document, Path file) {}
    @FunctionalInterface private interface Check { void run(Fixture fixture) throws Exception; }

    private Fixture fixture() {
        try {
            String name = "analysis-db-test-" + UUID.randomUUID();
            long source = jdbc.queryForObject("INSERT INTO data_source(source_name,source_format) VALUES (?,'TEST') RETURNING source_id",
                    Long.class, name + "-route");
            long mountain = jdbc.queryForObject("""
                    INSERT INTO mountain(mountain_name,mountain_display_location,source_id,source_hash,imported_at)
                    VALUES ('test',ST_SetSRID(ST_MakePoint(10,10),4326),?,?,now()) RETURNING mountain_id
                    """, Long.class, source, "a".repeat(64));
            long course = insertCourse(mountain, source);
            var document = document(mapper);
            section(document, "course").put("course_id", course).put("mountain_id", mountain).put("source_id", source);
            return new Fixture(course, mountain, source, name, document, write(inputDirectory, mapper, document));
        } catch (java.io.IOException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private long insertCourse(long mountainId, long sourceId) {
        return jdbc.queryForObject("""
                INSERT INTO course(mountain_id,course_name,course_geometry,source_id,source_hash,imported_at)
                VALUES (?,'test',ST_GeomFromText('LINESTRING(10 10,10.0002 10)',4326),?,?,now()) RETURNING course_id
                """, Long.class, mountainId, sourceId, UUID.randomUUID().toString().replace("-", "").repeat(2));
    }

    private void rollback(Check check) {
        transaction().executeWithoutResult(status -> {
            try { check.run(fixture()); }
            catch (RuntimeException | Error exception) { throw exception; }
            catch (Exception exception) { throw new IllegalStateException(exception); }
            finally { status.setRollbackOnly(); }
        });
    }

    private TransactionTemplate transaction() { return new TransactionTemplate(transactionManager); }
    private String payload(long id) {
        return jdbc.queryForObject("SELECT analysis_document::text FROM course_analysis WHERE analysis_id=?", String.class, id);
    }
    private void assertRemoved(long id, long demId) {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM course_analysis WHERE analysis_id=?", Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM data_source WHERE source_id=?", Integer.class, demId)).isZero();
    }
}
