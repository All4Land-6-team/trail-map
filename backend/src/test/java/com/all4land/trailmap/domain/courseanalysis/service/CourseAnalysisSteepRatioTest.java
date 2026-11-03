package com.all4land.trailmap.domain.courseanalysis.service;

import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository.AnalysisRow;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository.CourseRow;
import com.all4land.trailmap.domain.courseanalysis.storage.CourseAnalysisStore;
import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse.Metrics;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Path;
import java.nio.file.Files;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CourseAnalysisSteepRatioTest {
    @TempDir Path temporary;
    private final CourseAnalysisDocumentReader reader = new CourseAnalysisDocumentReader(mapper());

    @Test
    @EnabledIfEnvironmentVariable(named = "STEEP_ANALYSIS_DIRECTORY", matches = ".+")
    void validatesThirteenPreparedDocumentsWithoutConnectingToTheDatabase() throws Exception {
        try (var paths = Files.list(Path.of(System.getenv("STEEP_ANALYSIS_DIRECTORY")))) {
            var files = paths.filter(path -> path.getFileName().toString().matches("course-[0-9]+-steep\\.json"))
                    .sorted().toList();
            assertThat(files).hasSize(13);
            for (var file : files) {
                var validated = reader.read(file);
                assertThat(validated.document().schemaVersion()).isEqualTo(2);
                assertThat(validated.document().settings().steepSlopeThresholdPercent()).isEqualTo(20);
                var stored = new CourseAnalysisDocumentReader.Stored(1, 1, validated.hash(), validated.document());
                assertThat(reader.readStored(reader.encode(stored)).documentHash()).isEqualTo(validated.hash());
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"v1-confirmed-m.json", "v1-assumed-m.json"})
    void readsPreV2StoredBytesWithoutChangingTheirFingerprint(String filename) throws Exception {
        byte[] original;
        try (var input = getClass().getResourceAsStream("/course-analysis/" + filename)) {
            original = input.readAllBytes();
        }
        var stored = reader.readStored(original);
        assertThat(stored.document().schemaVersion()).isEqualTo(1);
        assertThat(stored.document().summary().steepSectionRatioPercent()).isNull();
        assertThat(reader.encode(stored)).isEqualTo(original);
    }

    @ParameterizedTest
    @CsvSource({"20,100,20", "50,100,20", "60,50,10", "100,50,10", "101,0,0"})
    void verifiesAbsoluteSlopeThresholdAndDistanceWeightedRatio(double threshold, double ratio, double distance) throws Exception {
        var root = steepDocument(threshold, ratio, distance);
        var document = reader.read(write(temporary, mapper(), root)).document();
        assertThat(document.summary().steepSectionRatioPercent()).isEqualTo(ratio);
    }

    @Test
    void independentlyVerifiesUnequalSegmentLengths() throws Exception {
        var root = steepDocument(20, 10, 1);
        sample(root, 1).put("distance_meters", 1).put("elevation_source_value", 101)
                .put("elevation_meters", 101).put("slope_percent", 100);
        sample(root, 2).put("distance_meters", 10).put("elevation_source_value", 101)
                .put("elevation_meters", 101).put("slope_percent", 0);
        section(root, "summary").put("distance_meters", 10).put("covered_distance_meters", 10)
                .put("slope_analyzed_distance_meters", 10).put("max_elevation_meters", 101)
                .put("elevation_gain_meters", 1).put("elevation_loss_meters", 0);
        assertThat(reader.read(write(temporary, mapper(), root)).document().summary().steepSectionRatioPercent()).isEqualTo(10);
        section(root, "summary").put("steep_section_ratio_percent", 50);
        invalid(root);
    }

    @Test
    void missingMiddleHasNoAnalyzableSlopeAndRatioIsNull() throws Exception {
        var root = steepDocument(20, 0, 0);
        sample(root, 1).put("sample_status", "NODATA").putNull("elevation_source_value")
                .putNull("elevation_meters").putNull("slope_percent");
        sample(root, 2).putNull("slope_percent");
        section(root, "summary").put("valid_dem_sample_count", 2).put("valid_elevation_meters_sample_count", 2)
                .put("sample_coverage_percent", 200.0 / 3).put("covered_distance_meters", 0).put("distance_coverage_percent", 0)
                .put("max_elevation_meters", 105).put("analyzed_segment_count", 0).put("slope_analyzed_distance_meters", 0)
                .putNull("elevation_gain_meters").putNull("elevation_loss_meters").putNull("steep_section_ratio_percent");
        section(root, "diagnostics").set("sample_status_counts", mapper().createObjectNode().put("VALID", 2).put("NODATA", 1));
        root.put("quality_status", "PARTIAL");
        root.withArray("quality_reasons").add("MISSING_DEM_SAMPLES").add("NO_CONTIGUOUS_METRIC_HEIGHT_SEGMENTS");
        assertThat(reader.read(write(temporary, mapper(), root)).document().summary().steepSectionRatioPercent()).isNull();
        section(root, "summary").put("steep_section_ratio_percent", 0);
        invalid(root);
    }

    @Test
    void refusesWrongPoliciesLengthsRatiosAndVersionClaims() throws Exception {
        List<Consumer<ObjectNode>> changes = List.of(
                root -> section(root, "settings").put("steep_slope_threshold_percent", 0),
                root -> section(root, "settings").put("steep_slope_method", "sample_count"),
                root -> root.put("algorithm_version", "course-dem-v2-steep-30.0"),
                root -> section(root, "summary").put("steep_section_ratio_percent", 50),
                root -> section(root, "summary").put("steep_distance_meters", -1),
                root -> section(root, "summary").put("slope_analyzed_distance_meters", 10),
                root -> root.put("schema_version", 1),
                root -> root.put("schema_version", 3));
        for (var change : changes) {
            var root = steepDocument(20, 100, 20);
            change.accept(root);
            invalid(root);
        }
    }

    @Test
    void singleBatchAndProfileReturnCanonicalRatioAndRejectARowMismatch() throws Exception {
        var validated = reader.read(write(temporary, mapper(), steepDocument(20, 100, 20)));
        var document = validated.document();
        var repository = mock(CourseAnalysisRepository.class);
        var store = mock(CourseAnalysisStore.class);
        var metrics = new Metrics(20.0, null, 100.0, 110.0, 10.0, 5.0, 100.0 - 1e-11);
        var row = new AnalysisRow(7, 1, 2, 1, 3, 1, 9, document.algorithmVersion(), document.sourceType(),
                document.qualityStatus(), document.calculatedAt(), metrics, true, true, reader.geometryJson(document.course().geometry()));
        when(repository.findCourse(1)).thenReturn(Optional.of(new CourseRow(1, 2, 1, 3, true)));
        when(repository.findLatest(1)).thenReturn(Optional.of(row));
        when(repository.findCourses(List.of(1L))).thenReturn(List.of(new CourseRow(1, 2, 1, 3, true)));
        when(repository.findLatestForCourses(List.of(1L))).thenReturn(List.of(row));
        when(repository.findById(7)).thenReturn(Optional.of(row));
        when(store.load(7)).thenReturn(new CourseAnalysisDocumentReader.Stored(7, 9, validated.hash(), document));
        var service = new CourseAnalysisService(repository, store, reader);
        var summary = service.getSummary(1);
        assertThat(summary.metrics().steepSectionRatioPercent()).isEqualTo(100);
        assertThat(summary.settings().steepSlopeThresholdPercent()).isEqualTo(20);
        assertThat(service.getProfile(7).analysis()).isEqualTo(summary);
        assertThat(service.getSummaries(List.of(1L))).containsExactly(summary);
        var corrupted = new AnalysisRow(7, 1, 2, 1, 3, 1, 9, document.algorithmVersion(), document.sourceType(),
                document.qualityStatus(), document.calculatedAt(), new Metrics(20.0, null, 100.0, 110.0, 10.0, 5.0, null),
                true, true, reader.geometryJson(document.course().geometry()));
        assertThatThrownBy(() -> service.loadVerified(corrupted)).isInstanceOf(CourseAnalysisException.class);
    }

    private ObjectNode steepDocument(double threshold, double ratio, double steepDistance) {
        var root = document(mapper());
        root.put("schema_version", 2).put("algorithm_version", "course-dem-v2-steep-" + threshold);
        section(root, "settings").put("steep_slope_threshold_percent", threshold)
                .put("steep_slope_method", "absolute_slope_gte_distance_weighted");
        section(root, "summary").put("slope_analyzed_distance_meters", 20)
                .put("steep_distance_meters", steepDistance).put("steep_section_ratio_percent", ratio);
        return root;
    }

    private void invalid(ObjectNode root) throws Exception {
        Path file = write(temporary, mapper(), root);
        assertThatThrownBy(() -> reader.read(file)).isInstanceOf(CourseAnalysisException.class);
    }
}
