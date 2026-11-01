-- Official visitor guidance is separate from candidate geometry and DEM analysis.
CREATE TABLE course_guide_metadata (
    course_id BIGINT PRIMARY KEY REFERENCES course (course_id),
    course_version INTEGER NOT NULL CHECK (course_version > 0),
    route_source_hash VARCHAR(64) NOT NULL CHECK (route_source_hash ~ '^[0-9a-f]{64}$'),
    official_course_id VARCHAR(30) NOT NULL,
    route_label VARCHAR(2000) NOT NULL,
    difficulty_grade VARCHAR(1) NOT NULL CHECK (difficulty_grade IN ('하', '중', '상')),
    distance_meters DOUBLE PRECISION NOT NULL CHECK (distance_meters > 0 AND distance_meters < 'Infinity'::float8),
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    source_url VARCHAR(2000) NOT NULL,
    checked_on DATE NOT NULL,
    document_hash VARCHAR(64) NOT NULL CHECK (document_hash ~ '^[0-9a-f]{64}$'),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
