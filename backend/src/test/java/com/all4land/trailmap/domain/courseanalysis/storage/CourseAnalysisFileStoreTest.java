package com.all4land.trailmap.domain.courseanalysis.storage;

import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.Stored;
import com.all4land.trailmap.global.config.CourseAnalysisProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionSynchronizationUtils;

import java.nio.file.Files;
import java.nio.file.Path;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.*;
import static org.assertj.core.api.Assertions.*;

class CourseAnalysisFileStoreTest {
    @TempDir Path temporary;

    @AfterEach
    void cleanSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) complete(TransactionSynchronization.STATUS_ROLLED_BACK);
    }

    @Test
    void commitRetainsACompleteReadableArtifact() throws Exception {
        var store = store(); var stored = stored(); begin();
        store.publish(stored);
        complete(TransactionSynchronization.STATUS_COMMITTED);
        assertThat(store.load(7)).isEqualTo(stored);
        try (var files = Files.list(temporary.resolve("store"))) {
            assertThat(files.map(p -> p.getFileName().toString())).containsExactly("7.json");
        }
    }

    @Test
    void rollbackRemovesOnlyTheNewArtifact() throws Exception {
        var store = store(); var stored = stored(); begin(); store.publish(stored);
        complete(TransactionSynchronization.STATUS_ROLLED_BACK);
        assertThat(temporary.resolve("store/7.json")).doesNotExist();
    }

    @Test
    void indeterminateCommitKeepsArtifactForRecovery() throws Exception {
        var store = store(); var stored = stored(); begin(); store.publish(stored);
        complete(TransactionSynchronization.STATUS_UNKNOWN);
        assertThat(temporary.resolve("store/7.json")).exists();
    }

    @Test
    void neverOverwritesOrDeletesAnExistingFile() throws Exception {
        var store = store(); var stored = stored();
        Files.createDirectories(temporary.resolve("store"));
        Path existing = temporary.resolve("store/7.json"); Files.writeString(existing, "existing bytes");
        begin();
        assertThatThrownBy(() -> store.publish(stored)).isInstanceOf(CourseAnalysisException.class);
        complete(TransactionSynchronization.STATUS_ROLLED_BACK);
        assertThat(Files.readString(existing)).isEqualTo("existing bytes");
    }

    @Test
    void corruptionAndMissingArtifactsAreUnavailable() throws Exception {
        var store = store(); var stored = stored(); begin(); store.publish(stored);
        complete(TransactionSynchronization.STATUS_COMMITTED);
        Path path = temporary.resolve("store/7.json");
        String content = Files.readString(path).replace("course-dem-v1", "course-dem-v2");
        Files.writeString(path, content);
        assertThatThrownBy(() -> store.load(7)).isInstanceOf(CourseAnalysisException.class);
        assertThatThrownBy(() -> store.load(8)).isInstanceOf(CourseAnalysisException.class);
    }

    @Test
    void publishingRequiresWritableTransaction() throws Exception {
        var store = store(); var stored = stored();
        assertThatThrownBy(() -> store.publish(stored)).isInstanceOf(IllegalStateException.class);
        begin(); TransactionSynchronizationManager.setCurrentTransactionReadOnly(true);
        assertThatThrownBy(() -> store.publish(stored)).isInstanceOf(IllegalStateException.class);
        assertThat(temporary.resolve("store")).doesNotExist();
    }

    @Test
    void supportsPlainWindowsAndFileUriConfigurationOnTheirNativePlatform() {
        assertThat(new CourseAnalysisProperties(temporary.toString()).directory()).isEqualTo(temporary.toAbsolutePath());
        assertThat(new CourseAnalysisProperties(temporary.toUri().toString()).directory()).isEqualTo(temporary.toAbsolutePath());
    }

    private CourseAnalysisFileStore store() {
        return new CourseAnalysisFileStore(new CourseAnalysisProperties(temporary.resolve("store").toString()),
                new CourseAnalysisDocumentReader(mapper()));
    }

    private Stored stored() throws Exception {
        var mapper = mapper();
        var valid = new CourseAnalysisDocumentReader(mapper).read(write(temporary, mapper, document(mapper)));
        return new Stored(7, 9, valid.hash(), valid.document());
    }

    private void begin() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
    }

    private void complete(int status) {
        TransactionSynchronizationUtils.invokeAfterCompletion(TransactionSynchronizationManager.getSynchronizations(), status);
        TransactionSynchronizationManager.clearSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(false);
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);
    }
}
