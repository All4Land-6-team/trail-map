package com.all4land.trailmap.domain.courseanalysis.service;

import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse.Metrics;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository.AnalysisRow;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository.CourseRow;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.Stored;
import com.all4land.trailmap.domain.courseanalysis.storage.CourseAnalysisStore;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.math.MathContext;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseAnalysisMetricConsistencyTest {
    @Mock CourseAnalysisRepository repository;
    @Mock CourseAnalysisStore store;
    @TempDir Path temporary;
    private final CourseAnalysisDocumentReader reader = new CourseAnalysisDocumentReader(mapper());
    private CourseAnalysisService service;
    private Stored stored;

    @BeforeEach
    void setUp() throws Exception {
        stored = read(preciseDocument());
        service = new CourseAnalysisService(repository, store, reader);
    }

    @ParameterizedTest
    @CsvSource({"true,false,false", "false,true,false", "false,false,true", "true,true,true"})
    void summaryAndComparisonMatchProfileWhenJdbcPrecisionDiffers(
            boolean roundedSummary, boolean roundedBatch, boolean roundedProfile) {
        var ids = List.of(1L);
        var precise = metrics(false, null, null);
        assertThat(metrics(true, null, null)).isNotEqualTo(precise);
        when(repository.findCourse(1)).thenReturn(Optional.of(course()));
        when(repository.findLatest(1)).thenReturn(Optional.of(row(metrics(roundedSummary, null, null))));
        when(repository.findCourses(ids)).thenReturn(List.of(course()));
        when(repository.findLatestForCourses(ids)).thenReturn(List.of(row(metrics(roundedBatch, null, null))));
        when(repository.findById(7)).thenReturn(Optional.of(row(metrics(roundedProfile, null, null))));
        when(store.load(7)).thenReturn(stored);

        var summary = service.getSummary(1);
        var comparison = service.getSummaries(ids).getFirst();
        var profile = service.getProfile(7);

        // 같은 분석 ID의 메타데이터는 DB 수치 표현과 무관하게 정확히 일치해야 한다.
        assertThat(summary).isEqualTo(profile.analysis()).isEqualTo(comparison);
        assertThat(summary.metrics()).isEqualTo(precise);
        assertThat(profile.samples()).hasSize(stored.document().profile().size());
        assertThat(profile.samples().getLast().distanceMeters()).isEqualTo(precise.distanceMeters());
        assertThat(profile.samples().getFirst().slopePercent()).isNull();
        assertThat(profile.samples().getLast().slopePercent())
                .isEqualTo(stored.document().profile().getLast().slopePercent());
    }

    @ParameterizedTest
    @CsvSource(value = {"null,null", "0,0.0", "3600,17.25"}, nullValues = "null")
    void retainsMetricsThatAreOnlyStoredInTheSummaryRow(Integer duration, Double steepRatio) {
        summaryRow(metrics(true, duration, steepRatio));
        assertThat(service.getSummary(1).metrics()).isEqualTo(metrics(false, duration, steepRatio));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void keepsMissingElevationsNullAndMeasuredZeroDistinct(boolean missing) throws Exception {
        var root = preciseDocument();
        for (int i = 0; i < 3; i++) {
            var point = sample(root, i);
            if (missing) {
                point.putNull("elevation_source_value").putNull("elevation_meters")
                        .putNull("slope_percent").put("sample_status", "NODATA");
            } else {
                point.put("elevation_source_value", 0).put("elevation_meters", 0);
                if (i > 0) point.put("slope_percent", 0);
            }
        }
        var summary = section(root, "summary");
        for (String field : List.of("min_elevation_meters", "max_elevation_meters",
                "elevation_gain_meters", "elevation_loss_meters")) {
            if (missing) summary.putNull(field);
            else summary.put(field, 0);
        }
        if (missing) {
            section(root, "diagnostics").putObject("sample_status_counts").put("NODATA", 3);
            summary.put("valid_dem_sample_count", 0).put("valid_elevation_meters_sample_count", 0)
                    .put("sample_coverage_percent", 0).put("covered_distance_meters", 0)
                    .put("distance_coverage_percent", 0).put("analyzed_segment_count", 0);
            root.put("quality_status", "NO_DATA");
            root.withArray("quality_reasons").add("MISSING_DEM_SAMPLES").add("NO_CONTIGUOUS_METRIC_HEIGHT_SEGMENTS");
        }
        stored = read(root);
        summaryRow(metrics(true, null, null));

        var response = service.getSummary(1);
        assertThat(response.metrics()).isEqualTo(metrics(false, null, null));
        if (missing) assertThat(response.metrics().elevationGainMeters()).isNull();
        else assertThat(response.metrics().elevationGainMeters()).isZero();
    }

    /** 실측 자료 없이 부동소수점 정밀도 차이를 재현하는 합성 프로필. */
    private ObjectNode preciseDocument() {
        var root = document(mapper());
        double[] distances = {0, 9.876543210987654, 19.123456789012344};
        double[] heights = {100.12345678901234, 112.34567890123456, 105.23456789012345};
        for (int i = 0; i < distances.length; i++) {
            var point = sample(root, i);
            point.put("distance_meters", distances[i]).put("elevation_source_value", heights[i])
                    .put("elevation_meters", heights[i]);
            if (i > 0) point.put("slope_percent", 100 * (heights[i] - heights[i - 1]) / (distances[i] - distances[i - 1]));
        }
        section(root, "summary").put("distance_meters", distances[2]).put("covered_distance_meters", distances[2])
                .put("min_elevation_meters", heights[0]).put("max_elevation_meters", heights[1])
                .put("elevation_gain_meters", heights[1] - heights[0])
                .put("elevation_loss_meters", heights[1] - heights[2]);
        return root;
    }

    private Stored read(ObjectNode root) throws Exception {
        var validated = reader.read(write(temporary, mapper(), root));
        return new Stored(7, 9, validated.hash(), validated.document());
    }

    private Metrics metrics(boolean rounded, Integer duration, Double steepRatio) {
        var summary = stored.document().summary();
        return new Metrics(number(summary.distanceMeters(), rounded), duration,
                number(summary.minElevationMeters(), rounded), number(summary.maxElevationMeters(), rounded),
                number(summary.elevationGainMeters(), rounded), number(summary.elevationLossMeters(), rounded), steepRatio);
    }

    private Double number(Double value, boolean rounded) {
        if (value == null || !rounded) return value;
        return BigDecimal.valueOf(value).round(new MathContext(15)).doubleValue();
    }

    private CourseRow course() { return new CourseRow(1, 2, 1, 3, true); }

    private AnalysisRow row(Metrics metrics) {
        var document = stored.document();
        return new AnalysisRow(7, 1, 2, 1, 3, 1, 9, document.algorithmVersion(), document.sourceType(),
                document.qualityStatus(), document.calculatedAt(), metrics,
                true, true, reader.geometryJson(document.course().geometry()));
    }

    private void summaryRow(Metrics metrics) {
        when(repository.findCourse(1)).thenReturn(Optional.of(course()));
        when(repository.findLatest(1)).thenReturn(Optional.of(row(metrics)));
        when(store.load(7)).thenReturn(stored);
    }
}
