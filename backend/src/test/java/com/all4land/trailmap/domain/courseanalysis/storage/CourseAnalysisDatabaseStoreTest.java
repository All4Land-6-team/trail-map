package com.all4land.trailmap.domain.courseanalysis.storage;

import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisDocumentRepository;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisDocumentRepository.DocumentRow;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.Stored;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CourseAnalysisDatabaseStoreTest {
    @TempDir Path temporary;
    private final CourseAnalysisDocumentRepository repository = mock(CourseAnalysisDocumentRepository.class);
    private final CourseAnalysisDocumentReader reader = new CourseAnalysisDocumentReader(mapper());
    private final CourseAnalysisDatabaseStore store = new CourseAnalysisDatabaseStore(repository, reader);

    @AfterEach
    void clearTransaction() {
        TransactionSynchronizationManager.clear();
    }

    @Test
    void missingCorruptAndMismatchedDocumentsAreUnavailable() throws Exception {
        var valid = reader.read(write(temporary, mapper(), document(mapper())));
        var stored = new Stored(7, 9, valid.hash(), valid.document());
        String payload = new String(reader.encode(stored), StandardCharsets.UTF_8);
        when(repository.find(7)).thenReturn(Optional.empty());
        unavailable(() -> store.load(7));
        for (var row : List.of(
                new DocumentRow(7, 9, valid.hash(), "{}"),
                new DocumentRow(8, 9, valid.hash(), payload),
                new DocumentRow(7, 10, valid.hash(), payload),
                new DocumentRow(7, 9, "0".repeat(64), payload),
                new DocumentRow(7, 9, valid.hash(), payload.replace("course-dem-v1", "tampered")))) {
            when(repository.find(7)).thenReturn(Optional.of(row));
            unavailable(() -> store.load(7));
        }
    }

    @Test
    void databaseFailureUsesTheExistingUnavailableResponse() {
        when(repository.find(7)).thenThrow(new DataAccessResourceFailureException("offline"));
        unavailable(() -> store.load(7));
    }

    @Test
    void publicationRequiresAWritableTransactionAndRefusesAnExistingDocument() throws Exception {
        var valid = reader.read(write(temporary, mapper(), document(mapper())));
        var stored = new Stored(7, 9, valid.hash(), valid.document());
        assertThatThrownBy(() -> store.publish(stored)).isInstanceOf(IllegalStateException.class);
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(true);
        assertThatThrownBy(() -> store.publish(stored)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(repository);
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);
        // publishIfAbsent=false also covers a missing summary or a different DEM identity.
        unavailable(() -> store.publish(stored));
    }

    private void unavailable(org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action).isInstanceOfSatisfying(CourseAnalysisException.class,
                error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.DATA_UNAVAILABLE));
    }
}
