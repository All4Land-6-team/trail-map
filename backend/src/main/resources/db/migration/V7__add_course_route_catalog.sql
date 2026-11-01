-- Imported candidate paths remain separate from official data and existing course analyses.
CREATE TABLE course_route_dataset (
    dataset_key VARCHAR(100) PRIMARY KEY,
    source_id BIGINT NOT NULL UNIQUE REFERENCES data_source (source_id),
    file_hash VARCHAR(64) NOT NULL CHECK (file_hash ~ '^[0-9a-f]{64}$'),
    bukhansan_mountain_id BIGINT NOT NULL REFERENCES mountain (mountain_id),
    dobongsan_mountain_id BIGINT NOT NULL REFERENCES mountain (mountain_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (bukhansan_mountain_id <> dobongsan_mountain_id)
);

CREATE TABLE course_route_metadata (
    course_id BIGINT PRIMARY KEY REFERENCES course (course_id),
    dataset_key VARCHAR(100) NOT NULL REFERENCES course_route_dataset (dataset_key),
    source_record_id VARCHAR(200) NOT NULL,
    mountain_key VARCHAR(30) NOT NULL CHECK (mountain_key IN ('bukhansan', 'dobongsan')),
    route_order INTEGER NOT NULL CHECK (route_order BETWEEN 1 AND 13),
    route_label VARCHAR(2000) NOT NULL,
    validation_status VARCHAR(100) NOT NULL,
    check_note TEXT NOT NULL,
    UNIQUE (dataset_key, source_record_id),
    UNIQUE (dataset_key, route_order)
);

CREATE INDEX ix_course_route_metadata_mountain ON course_route_metadata (mountain_key, route_order);
