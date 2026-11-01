package com.all4land.trailmap.domain.courseroute;

import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import com.all4land.trailmap.domain.courseroute.repository.CourseRouteRepository;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteDocumentReader;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteImportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import java.util.Optional;
import static com.all4land.trailmap.domain.courseroute.RouteTestDocuments.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CourseRouteImportServiceTest {
    @TempDir Path directory;
    private final ObjectMapper mapper = new ObjectMapper();
    private final CourseRouteRepository repository = mock(CourseRouteRepository.class);
    private final CourseRouteDocumentReader reader = new CourseRouteDocumentReader(mapper);
    private final CourseRouteImportService importer = new CourseRouteImportService(reader, repository);

    @Test
    void validatesDistinctExistingMountainsBeforeAnyInsert() throws Exception {
        Path file = write(mapper, directory, document(mapper));
        assertThatThrownBy(() -> importer.importFile(file, 1, 1)).isInstanceOf(CourseRouteException.class);
        verifyNoInteractions(repository);
        when(repository.mountainsExist(1, 2)).thenReturn(false);
        assertThatThrownBy(() -> importer.importFile(file, 1, 2)).isInstanceOf(CourseRouteException.class);
        verify(repository, never()).insertDataset(anyString(), anyString(), anyLong(), anyLong());
    }

    @Test
    void refusesChangedDatasetAndNeverOverwritesExistingRows() throws Exception {
        Path file = write(mapper, directory, document(mapper));
        when(repository.mountainsExist(1, 2)).thenReturn(true);
        when(repository.findDataset(CourseRouteImportService.DATASET_KEY))
                .thenReturn(Optional.of(new CourseRouteRepository.Dataset("different", 1, 2, 3)));
        assertThatThrownBy(() -> importer.importFile(file, 1, 2)).isInstanceOf(CourseRouteException.class);
        verify(repository, never()).insertRoute(anyString(), anyLong(), anyLong(), any());
        verify(repository, never()).insertDataset(anyString(), anyString(), anyLong(), anyLong());
    }

    @Test
    void refusesReplayWhenAnImportedCourseWasChanged() throws Exception {
        Path file = write(mapper, directory, document(mapper));
        when(repository.mountainsExist(1, 2)).thenReturn(true);
        when(repository.findDataset(CourseRouteImportService.DATASET_KEY))
                .thenReturn(Optional.of(new CourseRouteRepository.Dataset(reader.read(file).fileHash(), 1, 2, 3)));
        when(repository.matchesStored(anyLong(), anyLong(), any())).thenReturn(false);
        assertThatThrownBy(() -> importer.importFile(file, 1, 2)).isInstanceOf(CourseRouteException.class);
        verify(repository, never()).insertRoute(anyString(), anyLong(), anyLong(), any());
    }
}
