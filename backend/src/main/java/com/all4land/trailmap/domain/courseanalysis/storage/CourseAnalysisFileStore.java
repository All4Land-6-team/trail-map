package com.all4land.trailmap.domain.courseanalysis.storage;

import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.Stored;
import com.all4land.trailmap.global.config.CourseAnalysisProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

/** DB commit 이전에 완성 파일을 게시한다. rollback 때 이 트랜잭션이 생성한 파일만 제거한다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class CourseAnalysisFileStore {
    private final CourseAnalysisProperties properties;
    private final CourseAnalysisDocumentReader reader;

    public Stored load(long analysisId) {
        try {
            Stored stored = reader.readStored(path(analysisId));
            if (stored.analysisId() != analysisId) throw new IllegalArgumentException("analysisId mismatch");
            return stored;
        } catch (RuntimeException exception) {
            throw new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE);
        }
    }

    public void publish(Stored stored) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()
                || !TransactionSynchronizationManager.isSynchronizationActive()
                || TransactionSynchronizationManager.isCurrentTransactionReadOnly()) {
            throw new IllegalStateException("Analysis publication requires a writable transaction");
        }
        Path target = path(stored.analysisId());
        Path temporary = null;
        boolean published = false;
        try {
            byte[] bytes = reader.encode(stored);
            Files.createDirectories(properties.directory());
            temporary = Files.createTempFile(properties.directory(), ".analysis-", ".tmp");
            try (FileChannel channel = FileChannel.open(temporary, StandardOpenOption.WRITE)) {
                ByteBuffer buffer = ByteBuffer.wrap(bytes);
                while (buffer.hasRemaining()) channel.write(buffer);
                channel.force(true);
            }
            // NTFS/Linux에서 완성된 파일만 노출하며 기존 파일을 덮어쓰지 않는다.
            Files.createLink(target, temporary);
            published = true;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) remove(target);
                    // commit 여부가 UNKNOWN이면 파일을 남긴다. DB와 파일을 함께 확인해 복구한다.
                }
            });
        } catch (IOException | RuntimeException exception) {
            if (published) remove(target);
            throw new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE);
        } finally {
            if (temporary != null) remove(temporary);
        }
    }

    private Path path(long id) {
        if (id <= 0) throw new IllegalArgumentException("Invalid analysisId");
        return properties.directory().resolve(id + ".json");
    }

    private void remove(Path file) {
        try {
            Files.deleteIfExists(file);
        } catch (IOException exception) {
            log.error("Cannot remove analysis file {}", file.getFileName(), exception);
        }
    }
}
