package com.all4land.trailmap.domain.courseanalysis.service;

import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse.Metrics;
import com.all4land.trailmap.domain.courseanalysis.entity.AnalysisQualityStatus;
import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository.AnalysisRow;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository.CourseRow;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.Stored;
import com.all4land.trailmap.domain.courseanalysis.storage.CourseAnalysisFileStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CourseAnalysisServiceTest {
    @Mock CourseAnalysisRepository repository;
    @Mock CourseAnalysisFileStore store;
    @TempDir Path temporary;
    private CourseAnalysisDocumentReader reader;
    private CourseAnalysisService service;
    private Stored stored;

    @BeforeEach
    void setUp() throws Exception {
        var mapper = mapper(); reader = new CourseAnalysisDocumentReader(mapper);
        var root = document(mapper);
        // 개발용 단위 선언 + 수직 기준 미확인 상태를 그대로 전달한다.
        section(root, "settings").put("elevation_unit_source", "caller_declaration").putNull("vertical_reference");
        root.put("quality_status", "PARTIAL"); root.withArray("quality_reasons").add("UNVERIFIED_VERTICAL_REFERENCE");
        var validated = reader.read(write(temporary, mapper, root));
        stored = new Stored(7, 9, validated.hash(), validated.document());
        service = new CourseAnalysisService(repository, store, reader);
    }

    @Test
    void missingAnalysisHasNullMeasurementsInsteadOfZero() {
        when(repository.findCourse(1)).thenReturn(Optional.of(new CourseRow(1, 2, 3, 3, true)));
        when(repository.findLatest(1)).thenReturn(Optional.empty());
        var response = service.getSummary(1);
        assertThat(response.qualityStatus()).isEqualTo(AnalysisQualityStatus.NO_DATA);
        assertThat(response.qualityReasons()).containsExactly("ANALYSIS_NOT_FOUND");
        assertThat(response.metrics().distanceMeters()).isNull();
        assertThat(response.coverage()).isNull(); assertThat(response.analysisId()).isNull();
        verifyNoInteractions(store);
    }

    @Test
    void retainsPartialQualityAndDoesNotExposePrivatePaths() throws Exception {
        summaryRow(row(true, true, false));
        var response = service.getSummary(1);
        assertThat(response.qualityStatus()).isEqualTo(AnalysisQualityStatus.PARTIAL);
        assertThat(response.settings().elevationUnitSource()).isEqualTo("caller_declaration");
        assertThat(response.settings().verticalReference()).isNull();
        assertThat(response.sourceKind()).isEqualTo("development");
        assertThat(mapper().writeValueAsString(response)).doesNotContain("/local/test", "crs_wkt", "inputs");
    }

    @Test
    void changedVersionIsOutdatedWithoutChangingRecordedQuality() {
        summaryRow(row(false, true, false));
        var response = service.getSummary(1);
        assertThat(response.qualityStatus()).isEqualTo(AnalysisQualityStatus.OUTDATED);
        assertThat(response.recordedQualityStatus()).isEqualTo(AnalysisQualityStatus.PARTIAL);
        assertThat(response.qualityReasons()).contains("UNVERIFIED_VERTICAL_REFERENCE", "COURSE_VERSION_CHANGED");
    }

    @Test
    void changedGeometryIsOutdatedEvenWithoutVersionChange() {
        summaryRow(row(true, false, false));
        assertThat(service.getSummary(1).qualityReasons()).contains("COURSE_GEOMETRY_CHANGED");
    }

    @Test
    void profileKeepsFirstSlopeNullAndCoordinatesInLongitudeLatitudeOrder() {
        when(repository.findById(7)).thenReturn(Optional.of(row(true, true, false)));
        when(store.load(7)).thenReturn(stored);
        var response = service.getProfile(7);
        assertThat(response.samples().getFirst().slopePercent()).isNull();
        assertThat(response.samples().getLast().coordinate()).containsExactly(10.0002, 10.0);
        assertThat(response.samples().getLast().slopePercent()).isEqualTo(-50);
    }

    @Test
    void inconsistentDbSummaryIsUnavailable() {
        summaryRow(row(true, true, true));
        assertThatThrownBy(() -> service.getSummary(1)).isInstanceOfSatisfying(CourseAnalysisException.class,
                error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.DATA_UNAVAILABLE));
    }

    @Test
    void unknownCourseAndAnalysisAreDistinctNotFoundErrors() {
        when(repository.findCourse(1)).thenReturn(Optional.empty());
        when(repository.findById(7)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getSummary(1)).isInstanceOfSatisfying(CourseAnalysisException.class,
                error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.COURSE_NOT_FOUND));
        assertThatThrownBy(() -> service.getProfile(7)).isInstanceOfSatisfying(CourseAnalysisException.class,
                error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.ANALYSIS_NOT_FOUND));
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1})
    void invalidIdsDoNotQueryStorage(long id) {
        assertThatThrownBy(() -> service.getSummary(id)).isInstanceOf(CourseAnalysisException.class);
        assertThatThrownBy(() -> service.getProfile(id)).isInstanceOf(CourseAnalysisException.class);
        verifyNoInteractions(repository, store);
    }

    @Test
    void batchKeepsRequestedOrderAndMissingAnalysisWithoutRepeatingDbQueries() {
        var ids = List.of(2L, 1L);
        when(repository.findCourses(ids)).thenReturn(List.of(
                new CourseRow(1, 2, 1, 3, true), new CourseRow(2, 2, 1, 3, true)));
        when(repository.findLatestForCourses(ids)).thenReturn(List.of(row(true, true, false)));
        when(store.load(7)).thenReturn(stored);

        var responses = service.getSummaries(ids);

        assertThat(responses).extracting(response -> response.courseId()).containsExactly(2L, 1L);
        assertThat(responses.getFirst().qualityStatus()).isEqualTo(AnalysisQualityStatus.NO_DATA);
        assertThat(responses.getFirst().metrics().distanceMeters()).isNull();
        assertThat(responses.getFirst().profileUrl()).isNull();
        assertThat(responses.getLast().qualityStatus()).isEqualTo(AnalysisQualityStatus.PARTIAL);
        assertThat(responses.getLast().sourceKind()).isEqualTo("development");
        assertThat(responses.getLast().settings().verticalReference()).isNull();
        verify(repository, never()).findCourse(anyLong());
        verify(repository, never()).findLatest(anyLong());
        verify(store).load(7);
    }

    @Test
    void batchPreservesOutdatedVersionAndItsOriginalProfileReference() {
        var ids = List.of(1L, 2L);
        when(repository.findCourses(ids)).thenReturn(List.of(
                new CourseRow(1, 2, 2, 3, true), new CourseRow(2, 2, 1, 3, true)));
        when(repository.findLatestForCourses(ids)).thenReturn(List.of(row(false, true, false)));
        when(store.load(7)).thenReturn(stored);
        var response = service.getSummaries(ids).getFirst();
        assertThat(response.qualityStatus()).isEqualTo(AnalysisQualityStatus.OUTDATED);
        assertThat(response.recordedQualityStatus()).isEqualTo(AnalysisQualityStatus.PARTIAL);
        assertThat(response.currentCourseVersion()).isEqualTo(2);
        assertThat(response.analyzedCourseVersion()).isEqualTo(1);
        assertThat(response.profileUrl()).isEqualTo("/api/v1/course-analyses/7/profile");
    }

    @Test
    void batchRejectsMissingCoursesBeforeOpeningAnalysisFiles() {
        var ids = List.of(1L, 2L);
        when(repository.findCourses(ids)).thenReturn(List.of(new CourseRow(1, 2, 1, 3, true)));
        assertThatThrownBy(() -> service.getSummaries(ids)).isInstanceOfSatisfying(CourseAnalysisException.class,
                error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.COURSE_NOT_FOUND));
        verify(repository, never()).findLatestForCourses(anyList());
        verifyNoInteractions(store);
    }

    @Test
    void batchPropagatesUnavailableArtifactsInsteadOfFabricatingMissingAnalysis() {
        var ids = List.of(1L, 2L);
        when(repository.findCourses(ids)).thenReturn(List.of(
                new CourseRow(1, 2, 1, 3, true), new CourseRow(2, 2, 1, 3, true)));
        when(repository.findLatestForCourses(ids)).thenReturn(List.of(row(true, true, false)));
        when(store.load(7)).thenThrow(new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE));
        assertThatThrownBy(() -> service.getSummaries(ids)).isInstanceOfSatisfying(CourseAnalysisException.class,
                error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.DATA_UNAVAILABLE));
    }

    @Test
    void invalidBatchIdsDoNotQueryStorage() {
        for (var ids : List.of(List.<Long>of(), List.of(1L, 1L), List.of(0L, 1L))) {
            assertThatThrownBy(() -> service.getSummaries(ids)).isInstanceOf(CourseAnalysisException.class);
        }
        assertThatThrownBy(() -> service.getSummaries(null)).isInstanceOf(CourseAnalysisException.class);
        verifyNoInteractions(repository, store);
    }

    private void summaryRow(AnalysisRow row) {
        when(repository.findCourse(1)).thenReturn(Optional.of(new CourseRow(1, 2, row.currentCourseVersion(), 3, true)));
        when(repository.findLatest(1)).thenReturn(Optional.of(row));
        when(store.load(7)).thenReturn(stored);
    }

    private AnalysisRow row(boolean versionCurrent, boolean geometryCurrent, boolean wrongDistance) {
        var document = stored.document();
        return new AnalysisRow(7, 1, 2, versionCurrent ? 1 : 2, 3, 1, 9, "course-dem-v1", "SERVICE_CALCULATED",
                document.qualityStatus(), document.calculatedAt(),
                new Metrics(wrongDistance ? 21.0 : 20.0, null, 100.0, 110.0, 10.0, 5.0, null),
                versionCurrent, geometryCurrent, reader.geometryJson(document.course().geometry()));
    }
}
