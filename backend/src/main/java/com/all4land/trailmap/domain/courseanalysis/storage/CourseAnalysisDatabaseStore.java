package com.all4land.trailmap.domain.courseanalysis.storage;

import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisDocumentRepository;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.Stored;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.util.Objects;

/** 분석 요약과 같은 DB·트랜잭션을 사용하며 로컬 파일로 대체하지 않는다. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "course-analysis.storage", havingValue = "database", matchIfMissing = true)
public class CourseAnalysisDatabaseStore implements CourseAnalysisStore {
    private final CourseAnalysisDocumentRepository repository;
    private final CourseAnalysisDocumentReader reader;

    @Override
    public Stored load(long analysisId) {
        try {
            if (analysisId <= 0) throw new IllegalArgumentException("Invalid analysisId");
            var row = repository.find(analysisId).orElseThrow();
            var stored = reader.readStored(row.payload().getBytes(StandardCharsets.UTF_8));
            if (stored.analysisId() != analysisId || row.analysisId() != analysisId
                    || stored.demSourceId() != row.demSourceId()
                    || !Objects.equals(stored.documentHash(), row.documentHash())) {
                throw new IllegalArgumentException("Stored document identity mismatch");
            }
            return stored;
        } catch (RuntimeException exception) {
            throw new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE);
        }
    }

    @Override
    public void publish(Stored stored) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()
                || !TransactionSynchronizationManager.isSynchronizationActive()
                || TransactionSynchronizationManager.isCurrentTransactionReadOnly()) {
            throw new IllegalStateException("Analysis publication requires a writable transaction");
        }
        try {
            String payload = new String(reader.encode(stored), StandardCharsets.UTF_8);
            if (!repository.publishIfAbsent(stored.analysisId(), stored.demSourceId(), stored.documentHash(), payload)) {
                throw new IllegalArgumentException("Missing analysis row or existing document");
            }
        } catch (RuntimeException exception) {
            throw new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE);
        }
    }
}
