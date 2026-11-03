package com.all4land.trailmap.domain.courseanalysis.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class CourseAnalysisDocumentRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public record DocumentRow(long analysisId, long demSourceId, String documentHash, String payload) {}

    public Optional<DocumentRow> find(long analysisId) {
        return jdbc.query("""
                SELECT analysis_id, dem_source_id,
                       analysis_document->>'documentHash' AS document_hash,
                       analysis_document->>'payload' AS payload
                FROM course_analysis
                WHERE analysis_id=:id AND analysis_document IS NOT NULL
                """, new MapSqlParameterSource("id", analysisId), (rs, row) -> new DocumentRow(
                rs.getLong("analysis_id"), rs.getLong("dem_source_id"),
                rs.getString("document_hash"), rs.getString("payload"))).stream().findFirst();
    }

    /** 직렬화 원문은 JSONB 문자열로 보존해 -0.0 등의 수치 정규화가 문서 지문을 바꾸지 않게 한다. */
    public boolean publishIfAbsent(long analysisId, long demSourceId, String hash, String payload) {
        int changed = jdbc.update("""
                UPDATE course_analysis
                SET analysis_document=jsonb_build_object(
                    'formatVersion', 1, 'analysisId', CAST(:id AS bigint),
                    'demSourceId', CAST(:demId AS bigint), 'documentHash', CAST(:hash AS text),
                    'payload', CAST(:payload AS text))
                WHERE analysis_id=:id AND dem_source_id=:demId AND analysis_document IS NULL
                """, new MapSqlParameterSource("id", analysisId).addValue("demId", demSourceId)
                .addValue("hash", hash).addValue("payload", payload));
        return changed == 1;
    }
}
