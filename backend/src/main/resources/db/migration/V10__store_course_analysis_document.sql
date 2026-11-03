-- Existing file-backed rows remain unchanged and may use explicit file storage mode.
ALTER TABLE course_analysis ADD COLUMN analysis_document JSONB;

ALTER TABLE course_analysis
    ADD CONSTRAINT chk_course_analysis_document CHECK (
        analysis_document IS NULL OR (
            jsonb_typeof(analysis_document) = 'object'
            AND jsonb_typeof(analysis_document->'formatVersion') = 'number'
            AND analysis_document->>'formatVersion' = '1'
            AND jsonb_typeof(analysis_document->'analysisId') = 'number'
            AND analysis_document->>'analysisId' = analysis_id::text
            AND jsonb_typeof(analysis_document->'demSourceId') = 'number'
            AND analysis_document->>'demSourceId' = dem_source_id::text
            AND jsonb_typeof(analysis_document->'documentHash') = 'string'
            AND analysis_document->>'documentHash' ~ '^[0-9a-f]{64}$'
            AND jsonb_typeof(analysis_document->'payload') = 'string'
            AND octet_length(analysis_document->>'payload') BETWEEN 1 AND 67108864
        ) IS TRUE
    );

COMMENT ON COLUMN course_analysis.analysis_document IS
    'Versioned JSONB envelope with lossless serialized analysis document; source paths are not exposed by APIs';
