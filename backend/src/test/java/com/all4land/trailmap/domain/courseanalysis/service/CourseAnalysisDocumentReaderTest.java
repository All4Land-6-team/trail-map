package com.all4land.trailmap.domain.courseanalysis.service;

import com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments;
import com.all4land.trailmap.domain.courseanalysis.entity.AnalysisQualityStatus;
import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.Consumer;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.*;
import static org.assertj.core.api.Assertions.*;

class CourseAnalysisDocumentReaderTest {
    private final ObjectMapper mapper = mapper();
    private final CourseAnalysisDocumentReader reader = new CourseAnalysisDocumentReader(mapper);
    @TempDir Path temporary;

    @Test
    void verifiesKnownDistanceSignedSlopesAndCumulativeGainLoss() throws Exception {
        var result = reader.read(write(temporary, mapper, document(mapper)));
        assertThat(result.document().summary().elevationGainMeters()).isEqualTo(10);
        assertThat(result.document().summary().elevationLossMeters()).isEqualTo(5);
        assertThat(result.document().profile().get(2).slopePercent()).isEqualTo(-50);
        assertThat(result.hash()).matches("[0-9a-f]{64}");
    }

    @Test
    void unknownUnitsPreserveRawValuesAndNullMetricValues() throws Exception {
        ObjectNode root = document(mapper);
        section(root, "settings").put("elevation_unit", "unknown").put("elevation_unit_source", "unverified");
        root.put("quality_status", "PARTIAL");
        root.withArray("quality_reasons").add("UNVERIFIED_ELEVATION_UNIT").add("NO_CONTIGUOUS_METRIC_HEIGHT_SEGMENTS");
        for (int i = 0; i < 3; i++) sample(root, i).putNull("elevation_meters").putNull("slope_percent");
        section(root, "summary").put("valid_elevation_meters_sample_count", 0).put("analyzed_segment_count", 0)
                .putNull("min_elevation_meters").putNull("max_elevation_meters")
                .putNull("elevation_gain_meters").putNull("elevation_loss_meters");
        var result = reader.read(write(temporary, mapper, root));
        assertThat(result.document().profile().getFirst().elevationSourceValue()).isEqualTo(100);
        assertThat(result.document().summary().elevationGainMeters()).isNull();
    }

    @Test
    void doesNotBridgeMissingMiddleSample() throws Exception {
        ObjectNode root = document(mapper);
        missingMiddle(root);
        var result = reader.read(write(temporary, mapper, root)).document();
        assertThat(result.summary().elevationGainMeters()).isNull();
        assertThat(result.profile().getLast().slopePercent()).isNull();
        assertThat(result.qualityStatus()).isEqualTo(AnalysisQualityStatus.PARTIAL);
    }

    @Test
    void rejectsAProfileThatBridgesMissingSamples() throws Exception {
        ObjectNode root = document(mapper);
        missingMiddle(root);
        sample(root, 2).put("slope_percent", 25.0);
        invalid(root);
    }

    @Test
    void recognizesNoDataWithoutSubstitutingZeroHeights() throws Exception {
        ObjectNode root = document(mapper);
        for (int i = 0; i < 3; i++) sample(root, i).put("sample_status", "NODATA")
                .putNull("elevation_source_value").putNull("elevation_meters").putNull("slope_percent");
        section(root, "diagnostics").set("sample_status_counts", mapper.createObjectNode().put("NODATA", 3));
        section(root, "summary").put("valid_dem_sample_count", 0).put("valid_elevation_meters_sample_count", 0)
                .put("sample_coverage_percent", 0).put("covered_distance_meters", 0).put("distance_coverage_percent", 0)
                .put("analyzed_segment_count", 0).putNull("min_elevation_meters").putNull("max_elevation_meters")
                .putNull("elevation_gain_meters").putNull("elevation_loss_meters");
        root.put("quality_status", "NO_DATA");
        root.withArray("quality_reasons").add("MISSING_DEM_SAMPLES").add("NO_CONTIGUOUS_METRIC_HEIGHT_SEGMENTS");
        assertThat(reader.read(write(temporary, mapper, root)).document().qualityStatus()).isEqualTo(AnalysisQualityStatus.NO_DATA);
    }

    @Test
    void zeroIsAValidElevationAndGain() throws Exception {
        ObjectNode root = document(mapper);
        for (int i = 0; i < 3; i++) {
            sample(root, i).put("elevation_source_value", 0).put("elevation_meters", 0);
            if (i > 0) sample(root, i).put("slope_percent", 0);
        }
        section(root, "summary").put("min_elevation_meters", 0).put("max_elevation_meters", 0)
                .put("elevation_gain_meters", 0).put("elevation_loss_meters", 0);
        assertThat(reader.read(write(temporary, mapper, root)).document().summary().elevationGainMeters()).isZero();
    }

    @Test
    void verifiesInternationalFeetConversion() throws Exception {
        ObjectNode root = document(mapper);
        section(root, "settings").put("elevation_unit", "ft");
        section(section(root, "inputs"), "dem").put("band_unit", "ft");
        sample(root, 0).put("elevation_meters", 30.48);
        sample(root, 1).put("elevation_meters", 33.528).put("slope_percent", 30.48);
        sample(root, 2).put("elevation_meters", 32.004).put("slope_percent", -15.24);
        section(root, "summary").put("min_elevation_meters", 30.48).put("max_elevation_meters", 33.528)
                .put("elevation_gain_meters", 3.048).put("elevation_loss_meters", 1.524);
        assertThat(reader.read(write(temporary, mapper, root)).document().summary().maxElevationMeters()).isEqualTo(33.528);
    }

    @ParameterizedTest
    @CsvSource({"distance_meters,21", "sample_count,2", "valid_dem_sample_count,2",
            "valid_elevation_meters_sample_count,2", "min_elevation_meters,99", "max_elevation_meters,111",
            "elevation_gain_meters,11", "elevation_loss_meters,6", "analyzed_segment_count,1",
            "sample_coverage_percent,99", "covered_distance_meters,19", "distance_coverage_percent,90"})
    void rejectsInconsistentSummary(String field, double value) throws Exception {
        var root = document(mapper);
        if (field.endsWith("count")) section(root, "summary").put(field, (int) value);
        else section(root, "summary").put(field, value);
        invalid(root);
    }

    @ParameterizedTest
    @ValueSource(strings = {"schema_version", "course", "inputs", "profile", "summary", "settings", "quality_reasons", "diagnostics"})
    void rejectsMissingRequiredSections(String field) throws Exception {
        var root = document(mapper); root.remove(field); invalid(root);
    }

    @Test
    void rejectsBadIdentifiersCoordinatesSettingsAndQuality() throws Exception {
        invalidChange(root -> section(root, "course").put("course_id", 0));
        invalidChange(root -> section(root, "course").put("course_id", "1"));
        invalidChange(root -> section(root, "course").put("course_version", 1.2));
        invalidChange(root -> section(root, "course").put("source_kind", "invented"));
        invalidChange(root -> sample(root, 1).put("longitude", 181));
        invalidChange(root -> sample(root, 1).put("distance_meters", 0));
        invalidChange(root -> sample(root, 1).put("sample_index", 0));
        invalidChange(root -> sample(root, 1).put("slope_percent", 1));
        invalidChange(root -> section(root, "settings").put("max_samples", 2));
        invalidChange(root -> section(root, "settings").put("sample_interval_meters", 0));
        invalidChange(root -> section(root, "settings").put("vertical_reference", "unknown"));
        invalidChange(root -> section(section(root, "inputs"), "dem").put("band_unit", "ft"));
        invalidChange(root -> root.put("schema_version", 2));
        invalidChange(root -> root.put("quality_status", "PARTIAL"));
        invalidChange(root -> root.put("source_type", "OFFICIAL"));
        invalidChange(root -> root.put("calculated_at", "2026-10-28T00:00:00"));
        invalidChange(root -> root.put("unexpected_field", true));
    }

    @Test
    void rejectsDuplicateKeysTrailingDocumentsAndNonFiniteValues() throws Exception {
        String base = document(mapper).toString();
        for (String text : new String[]{base + " {}", base.replace("\"schema_version\":1", "\"schema_version\":1,\"schema_version\":1"),
                base.replace("\"slope_percent\":100.0", "\"slope_percent\":1e999")}) {
            Path file = Files.createTempFile(temporary, "invalid-", ".json");
            Files.writeString(file, text);
            assertThatThrownBy(() -> reader.read(file)).isInstanceOf(CourseAnalysisException.class);
        }
    }

    @Test
    void fingerprintIgnoresFormattingAndDemVersionIgnoresLocalPaths() throws Exception {
        var root = document(mapper);
        Path compact = write(temporary, mapper, root);
        Path pretty = Files.createTempFile(temporary, "pretty-", ".json");
        mapper.writerWithDefaultPrettyPrinter().writeValue(pretty.toFile(), root);
        var first = reader.read(compact);
        assertThat(reader.read(pretty).hash()).isEqualTo(first.hash());
        section(section(root, "inputs"), "dem").put("path", "C:\\different\\dem.tif");
        root.put("calculated_at", "2026-10-29T00:00:00Z");
        var relocated = reader.read(write(temporary, mapper, root));
        assertThat(reader.demVersion(first.document().inputs().dem(), first.document().settings()))
                .isEqualTo(reader.demVersion(relocated.document().inputs().dem(), relocated.document().settings()));
        assertThat(reader.sameResult(first.document(), relocated.document())).isTrue();
        assertThat(relocated.hash()).isNotEqualTo(first.hash());
    }

    @Test
    void confirmingVerticalReferenceCreatesANewDemInterpretationVersion() throws Exception {
        var root = document(mapper);
        var verified = reader.read(write(temporary, mapper, root)).document();
        section(root, "settings").putNull("vertical_reference");
        root.put("quality_status", "PARTIAL"); root.withArray("quality_reasons").add("UNVERIFIED_VERTICAL_REFERENCE");
        var unverified = reader.read(write(temporary, mapper, root)).document();
        assertThat(reader.demVersion(verified.inputs().dem(), verified.settings()))
                .isNotEqualTo(reader.demVersion(unverified.inputs().dem(), unverified.settings()));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "ANALYSIS_SAMPLE_JSON", matches = ".+")
    void validatesAnExplicitlyProvidedLocalPipelineOutput() {
        assertThat(reader.read(Path.of(System.getenv("ANALYSIS_SAMPLE_JSON"))).document().profile()).hasSizeGreaterThanOrEqualTo(2);
    }

    private void invalidChange(Consumer<ObjectNode> change) throws Exception {
        var root = document(mapper); change.accept(root); invalid(root);
    }

    private void invalid(ObjectNode root) throws Exception {
        Path file = write(temporary, mapper, root);
        assertThatThrownBy(() -> reader.read(file)).isInstanceOfSatisfying(CourseAnalysisException.class,
                error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.INVALID_DOCUMENT));
    }

    private void missingMiddle(ObjectNode root) {
        sample(root, 1).put("sample_status", "NODATA").putNull("elevation_source_value")
                .putNull("elevation_meters").putNull("slope_percent");
        sample(root, 2).putNull("slope_percent");
        section(root, "diagnostics").set("sample_status_counts", mapper.createObjectNode().put("VALID", 2).put("NODATA", 1));
        section(root, "summary").put("valid_dem_sample_count", 2).put("valid_elevation_meters_sample_count", 2)
                .put("sample_coverage_percent", 200.0 / 3).put("covered_distance_meters", 0).put("distance_coverage_percent", 0)
                .put("max_elevation_meters", 105).put("analyzed_segment_count", 0)
                .putNull("elevation_gain_meters").putNull("elevation_loss_meters");
        root.put("quality_status", "PARTIAL");
        root.withArray("quality_reasons").add("MISSING_DEM_SAMPLES").add("NO_CONTIGUOUS_METRIC_HEIGHT_SEGMENTS");
    }
}
