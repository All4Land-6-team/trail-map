package com.all4land.trailmap.domain.courseanalysis.service;

import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse.Metrics;
import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository.AnalysisRow;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository.CourseRow;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.Stored;
import com.all4land.trailmap.domain.courseanalysis.storage.CourseAnalysisFileStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.util.Optional;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CourseAnalysisImportServiceTest {
    @Mock CourseAnalysisRepository repository;
    @Mock CourseAnalysisFileStore store;
    @Mock CourseAnalysisService queries;
    @TempDir Path temporary;
    private CourseAnalysisDocumentReader reader;
    private CourseAnalysisImportService importer;

    @BeforeEach
    void setUp() {
        reader = new CourseAnalysisDocumentReader(mapper());
        importer = new CourseAnalysisImportService(repository, reader, store, queries);
    }

    @Test
    void publishesTheDocumentBoundToTheGeneratedAnalysisAndDemIds() throws Exception {
        Path file = write(temporary, mapper(), document(mapper()));
        currentCourse();
        when(repository.findExisting(1, 1, 9, "course-dem-v1")).thenReturn(Optional.empty());
        when(repository.insert(any(), eq(9L), anyString())).thenReturn(7L);
        var result = importer.importFile(file, "test DEM", "test");
        assertThat(result).isEqualTo(new CourseAnalysisImportService.ImportResult(7, 9, true));
        var capture = ArgumentCaptor.forClass(Stored.class);
        verify(store).publish(capture.capture());
        assertThat(capture.getValue().analysisId()).isEqualTo(7);
        assertThat(capture.getValue().demSourceId()).isEqualTo(9);
        assertThat(capture.getValue().documentHash()).isEqualTo(reader.read(file).hash());
    }

    @Test
    void equivalentRepeatRunReusesTheOriginalArtifact() throws Exception {
        var mapper = mapper(); var original = document(mapper);
        var validated = reader.read(write(temporary, mapper, original));
        var row = existingRow(validated);
        currentCourse();
        when(repository.findExisting(1, 1, 9, "course-dem-v1")).thenReturn(Optional.of(row));
        when(queries.loadVerified(row)).thenReturn(new Stored(7, 9, validated.hash(), validated.document()));
        original.put("calculated_at", "2026-10-29T00:00:00Z");
        assertThat(importer.importFile(write(temporary, mapper, original), "test DEM", "test").inserted()).isFalse();
        verifyNoInteractions(store);
        verify(repository, never()).insert(any(), anyLong(), anyString());
    }

    @Test
    void changedSettingsCannotReplaceAnExistingResult() throws Exception {
        var mapper = mapper(); var root = document(mapper);
        var validated = reader.read(write(temporary, mapper, root));
        var row = existingRow(validated);
        currentCourse();
        when(repository.findExisting(1, 1, 9, "course-dem-v1")).thenReturn(Optional.of(row));
        when(queries.loadVerified(row)).thenReturn(new Stored(7, 9, validated.hash(), validated.document()));
        section(root, "settings").put("sampling_method", "nearest");
        Path different = write(temporary, mapper, root);
        assertThatThrownBy(() -> importer.importFile(different, "test DEM", "test"))
                .isInstanceOfSatisfying(CourseAnalysisException.class,
                        error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.RESULT_CONFLICT));
        verifyNoInteractions(store);
    }

    @Test
    void staleCourseIsRejectedBeforeCreatingAnySourceOrArtifact() throws Exception {
        when(repository.lockCourse(eq(1L), anyString())).thenReturn(Optional.of(new CourseRow(1, 2, 2, 3, true)));
        Path file = write(temporary, mapper(), document(mapper()));
        assertThatThrownBy(() -> importer.importFile(file, "test DEM", "test"))
                .isInstanceOfSatisfying(CourseAnalysisException.class,
                        error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.COURSE_CHANGED));
        verify(repository, never()).findOrCreateDemSource(any(), any(), any(), any());
        verifyNoInteractions(store, queries);
    }

    private void currentCourse() {
        when(repository.lockCourse(eq(1L), anyString())).thenReturn(Optional.of(new CourseRow(1, 2, 1, 3, true)));
        when(repository.findOrCreateDemSource(eq("test DEM"), eq("test"), anyString(), eq("CUSTOM_WKT"))).thenReturn(9L);
    }

    private AnalysisRow existingRow(CourseAnalysisDocumentReader.Validated validated) {
        return new AnalysisRow(7, 1, 2, 1, 3, 1, 9, "course-dem-v1", "SERVICE_CALCULATED",
                validated.document().qualityStatus(), validated.document().calculatedAt(),
                new Metrics(20.0, null, 100.0, 110.0, 10.0, 5.0, null), true, true,
                reader.geometryJson(validated.document().course().geometry()));
    }
}
