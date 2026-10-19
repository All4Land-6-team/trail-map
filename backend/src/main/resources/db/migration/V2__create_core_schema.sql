CREATE TABLE data_source (
    source_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_name VARCHAR(200) NOT NULL,
    provider_name VARCHAR(200),
    source_url VARCHAR(2000),
    source_format VARCHAR(30) NOT NULL,
    source_crs VARCHAR(100),
    source_version VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_user (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nickname VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_app_user_nickname_not_blank
        CHECK (nickname IS NULL OR length(btrim(nickname)) > 0)
);

CREATE TABLE mountain (
    mountain_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mountain_name VARCHAR(200) NOT NULL,
    mountain_display_location geometry(Point, 4326) NOT NULL,
    mountain_boundary geometry(MultiPolygon, 4326),
    source_id BIGINT NOT NULL,
    source_record_id VARCHAR(200),
    source_date DATE,
    source_hash VARCHAR(64) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mountain_source
        FOREIGN KEY (source_id) REFERENCES data_source (source_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_mountain_display_location
        CHECK (NOT ST_IsEmpty(mountain_display_location) AND ST_IsValid(mountain_display_location)),
    CONSTRAINT chk_mountain_boundary
        CHECK (mountain_boundary IS NULL OR (NOT ST_IsEmpty(mountain_boundary) AND ST_IsValid(mountain_boundary))),
    CONSTRAINT chk_mountain_source_hash
        CHECK (source_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE course (
    course_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mountain_id BIGINT NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    course_geometry geometry(LineString, 4326) NOT NULL,
    course_difficulty VARCHAR(30),
    official_distance_meters DOUBLE PRECISION,
    official_duration_seconds INTEGER,
    course_version INTEGER NOT NULL DEFAULT 1,
    source_id BIGINT NOT NULL,
    source_record_id VARCHAR(200),
    source_date DATE,
    source_hash VARCHAR(64) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_course_mountain
        FOREIGN KEY (mountain_id) REFERENCES mountain (mountain_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_course_source
        FOREIGN KEY (source_id) REFERENCES data_source (source_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_course_geometry
        CHECK (NOT ST_IsEmpty(course_geometry) AND ST_IsValid(course_geometry)),
    CONSTRAINT chk_course_difficulty
        CHECK (course_difficulty IS NULL OR course_difficulty IN ('BEGINNER', 'INTERMEDIATE', 'EXPERT')),
    CONSTRAINT chk_course_official_distance
        CHECK (official_distance_meters IS NULL OR official_distance_meters > 0),
    CONSTRAINT chk_course_official_duration
        CHECK (official_duration_seconds IS NULL OR official_duration_seconds > 0),
    CONSTRAINT chk_course_version
        CHECK (course_version >= 1),
    CONSTRAINT chk_course_source_hash
        CHECK (source_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE saved_course (
    saved_course_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_saved_course_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_saved_course_course
        FOREIGN KEY (course_id) REFERENCES course (course_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE course_analysis (
    analysis_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id BIGINT NOT NULL,
    course_version INTEGER NOT NULL,
    dem_source_id BIGINT NOT NULL,
    algorithm_version VARCHAR(100) NOT NULL,
    analyzed_course_geometry geometry(LineString, 4326) NOT NULL,
    source_type VARCHAR(30) NOT NULL DEFAULT 'SERVICE_CALCULATED',
    distance_meters DOUBLE PRECISION,
    estimated_duration_seconds INTEGER,
    max_elevation_meters DOUBLE PRECISION,
    min_elevation_meters DOUBLE PRECISION,
    elevation_gain_meters DOUBLE PRECISION,
    elevation_loss_meters DOUBLE PRECISION,
    steep_section_ratio_percent DOUBLE PRECISION,
    quality_status VARCHAR(30) NOT NULL,
    calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_course_analysis_course
        FOREIGN KEY (course_id) REFERENCES course (course_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_course_analysis_dem_source
        FOREIGN KEY (dem_source_id) REFERENCES data_source (source_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT uq_course_analysis_version
        UNIQUE (course_id, course_version, dem_source_id, algorithm_version),
    CONSTRAINT chk_course_analysis_version
        CHECK (course_version >= 1),
    CONSTRAINT chk_course_analysis_geometry
        CHECK (NOT ST_IsEmpty(analyzed_course_geometry) AND ST_IsValid(analyzed_course_geometry)),
    CONSTRAINT chk_course_analysis_source_type
        CHECK (source_type = 'SERVICE_CALCULATED'),
    CONSTRAINT chk_course_analysis_distance
        CHECK (distance_meters IS NULL OR distance_meters > 0),
    CONSTRAINT chk_course_analysis_duration
        CHECK (estimated_duration_seconds IS NULL OR estimated_duration_seconds > 0),
    CONSTRAINT chk_course_analysis_elevation_range
        CHECK (max_elevation_meters IS NULL OR min_elevation_meters IS NULL OR max_elevation_meters >= min_elevation_meters),
    CONSTRAINT chk_course_analysis_elevation_gain
        CHECK (elevation_gain_meters IS NULL OR elevation_gain_meters >= 0),
    CONSTRAINT chk_course_analysis_elevation_loss
        CHECK (elevation_loss_meters IS NULL OR elevation_loss_meters >= 0),
    CONSTRAINT chk_course_analysis_steep_ratio
        CHECK (steep_section_ratio_percent IS NULL OR steep_section_ratio_percent BETWEEN 0 AND 100),
    CONSTRAINT chk_course_analysis_quality_status
        CHECK (quality_status IN ('AVAILABLE', 'PARTIAL', 'NO_DATA', 'OUTDATED', 'PROCESSING', 'FAILED'))
);

CREATE TABLE facility (
    facility_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mountain_id BIGINT,
    facility_name VARCHAR(200),
    facility_type VARCHAR(40) NOT NULL,
    facility_location geometry(Point, 4326) NOT NULL,
    official_status VARCHAR(100),
    source_id BIGINT NOT NULL,
    source_record_id VARCHAR(200),
    source_date DATE,
    source_hash VARCHAR(64) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_facility_mountain
        FOREIGN KEY (mountain_id) REFERENCES mountain (mountain_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_facility_source
        FOREIGN KEY (source_id) REFERENCES data_source (source_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_facility_location
        CHECK (NOT ST_IsEmpty(facility_location) AND ST_IsValid(facility_location)),
    CONSTRAINT chk_facility_source_hash
        CHECK (source_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE hike_schedule (
    schedule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    scheduled_starts_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_hike_schedule_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_hike_schedule_course
        FOREIGN KEY (course_id) REFERENCES course (course_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE hike_record (
    hike_record_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    course_version INTEGER NOT NULL,
    recorded_course_geometry geometry(LineString, 4326) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    hike_status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
    traveled_distance_meters DOUBLE PRECISION,
    actual_duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_hike_record_schedule
        FOREIGN KEY (schedule_id) REFERENCES hike_schedule (schedule_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_hike_record_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_hike_record_course
        FOREIGN KEY (course_id) REFERENCES course (course_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT uq_hike_record_schedule
        UNIQUE (schedule_id),
    CONSTRAINT chk_hike_record_course_version
        CHECK (course_version >= 1),
    CONSTRAINT chk_hike_record_geometry
        CHECK (NOT ST_IsEmpty(recorded_course_geometry) AND ST_IsValid(recorded_course_geometry)),
    CONSTRAINT chk_hike_record_time_range
        CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT chk_hike_record_status
        CHECK (hike_status IN ('IN_PROGRESS', 'DESCENDING', 'COMPLETED')),
    CONSTRAINT chk_hike_record_completion
        CHECK ((hike_status = 'COMPLETED') = (ended_at IS NOT NULL)),
    CONSTRAINT chk_hike_record_distance
        CHECK (traveled_distance_meters IS NULL OR traveled_distance_meters >= 0),
    CONSTRAINT chk_hike_record_duration
        CHECK (actual_duration_seconds IS NULL OR actual_duration_seconds >= 0)
);

CREATE TABLE mountain_review (
    review_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    mountain_id BIGINT NOT NULL,
    review_content TEXT NOT NULL,
    visited_date DATE,
    rating NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_mountain_review_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_mountain_review_mountain
        FOREIGN KEY (mountain_id) REFERENCES mountain (mountain_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_mountain_review_content
        CHECK (length(btrim(review_content)) > 0)
);

CREATE TABLE course_review (
    review_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    review_content TEXT NOT NULL,
    visited_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_course_review_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_course_review_course
        FOREIGN KEY (course_id) REFERENCES course (course_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_course_review_content
        CHECK (length(btrim(review_content)) > 0)
);

CREATE TABLE user_spot (
    spot_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    mountain_id BIGINT,
    hike_record_id BIGINT,
    spot_type VARCHAR(40) NOT NULL,
    spot_location geometry(Point, 4326) NOT NULL,
    spot_name TEXT,
    spot_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_user_spot_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_user_spot_mountain
        FOREIGN KEY (mountain_id) REFERENCES mountain (mountain_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_user_spot_hike_record
        FOREIGN KEY (hike_record_id) REFERENCES hike_record (hike_record_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_user_spot_type
        CHECK (spot_type IN ('REST_AREA', 'DRINKING_FOUNTAIN', 'PHOTO_SPOT', 'OTHER')),
    CONSTRAINT chk_user_spot_location
        CHECK (NOT ST_IsEmpty(spot_location) AND ST_IsValid(spot_location)),
    CONSTRAINT chk_user_spot_name
        CHECK (spot_name IS NULL OR length(btrim(spot_name)) > 0),
    CONSTRAINT chk_user_spot_status
        CHECK (spot_status IN ('PENDING', 'COMMUNITY_VERIFIED', 'RECONFIRMATION_REQUIRED', 'HIDDEN'))
);

CREATE TABLE spot_review (
    review_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    spot_id BIGINT NOT NULL,
    review_content TEXT NOT NULL,
    visited_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_spot_review_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_spot_review_spot
        FOREIGN KEY (spot_id) REFERENCES user_spot (spot_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_spot_review_content
        CHECK (length(btrim(review_content)) > 0)
);

CREATE TABLE facility_report (
    facility_report_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    report_type VARCHAR(40) NOT NULL,
    visited_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_facility_report_facility
        FOREIGN KEY (facility_id) REFERENCES facility (facility_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_facility_report_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_facility_report_type
        CHECK (report_type IN ('AVAILABLE', 'NOT_FOUND', 'UNAVAILABLE', 'UNDER_CONSTRUCTION', 'WRONG_LOCATION'))
);

CREATE TABLE photo (
    photo_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    mountain_review_id BIGINT,
    course_review_id BIGINT,
    spot_review_id BIGINT,
    spot_id BIGINT,
    object_key VARCHAR(1024) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    media_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_photo_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_photo_mountain_review
        FOREIGN KEY (mountain_review_id) REFERENCES mountain_review (review_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_photo_course_review
        FOREIGN KEY (course_review_id) REFERENCES course_review (review_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_photo_spot_review
        FOREIGN KEY (spot_review_id) REFERENCES spot_review (review_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_photo_spot
        FOREIGN KEY (spot_id) REFERENCES user_spot (spot_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT uq_photo_object_key
        UNIQUE (object_key),
    CONSTRAINT chk_photo_single_target
        CHECK (num_nonnulls(mountain_review_id, course_review_id, spot_review_id, spot_id) = 1),
    CONSTRAINT chk_photo_file_size
        CHECK (file_size_bytes > 0),
    CONSTRAINT chk_photo_display_order
        CHECK (display_order >= 0),
    CONSTRAINT chk_photo_media_type
        CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp'))
);

CREATE UNIQUE INDEX uq_saved_course_active
    ON saved_course (user_id, course_id)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_saved_course_user_id ON saved_course (user_id);
CREATE INDEX ix_saved_course_course_id ON saved_course (course_id);

CREATE UNIQUE INDEX uq_mountain_source_id
    ON mountain (source_id, source_record_id)
    WHERE source_record_id IS NOT NULL;
CREATE UNIQUE INDEX uq_mountain_source_hash
    ON mountain (source_id, source_hash)
    WHERE source_record_id IS NULL;
CREATE INDEX ix_mountain_mountain_display_location
    ON mountain USING GIST (mountain_display_location);
CREATE INDEX ix_mountain_mountain_boundary
    ON mountain USING GIST (mountain_boundary);
CREATE INDEX ix_mountain_source_id ON mountain (source_id);

CREATE INDEX ix_course_mountain ON course (mountain_id);
CREATE UNIQUE INDEX uq_course_source_id
    ON course (source_id, source_record_id)
    WHERE source_record_id IS NOT NULL;
CREATE UNIQUE INDEX uq_course_source_hash
    ON course (source_id, source_hash)
    WHERE source_record_id IS NULL;
CREATE INDEX ix_course_course_geometry ON course USING GIST (course_geometry);
CREATE INDEX ix_course_source_id ON course (source_id);

CREATE INDEX ix_course_analysis_dem_source_id ON course_analysis (dem_source_id);
CREATE INDEX ix_course_analysis_analyzed_course_geometry
    ON course_analysis USING GIST (analyzed_course_geometry);

CREATE UNIQUE INDEX uq_facility_source_id
    ON facility (source_id, source_record_id)
    WHERE source_record_id IS NOT NULL;
CREATE UNIQUE INDEX uq_facility_source_hash
    ON facility (source_id, source_hash)
    WHERE source_record_id IS NULL;
CREATE INDEX ix_facility_facility_location ON facility USING GIST (facility_location);
CREATE INDEX ix_facility_mountain_id ON facility (mountain_id);
CREATE INDEX ix_facility_source_id ON facility (source_id);

CREATE UNIQUE INDEX uq_hike_schedule_day
    ON hike_schedule (user_id, ((scheduled_starts_at AT TIME ZONE 'Asia/Seoul')::date))
    WHERE deleted_at IS NULL;
CREATE INDEX ix_hike_schedule_user_id ON hike_schedule (user_id);
CREATE INDEX ix_hike_schedule_course_id ON hike_schedule (course_id);

CREATE UNIQUE INDEX uq_hike_record_active_user
    ON hike_record (user_id)
    WHERE deleted_at IS NULL AND hike_status IN ('IN_PROGRESS', 'DESCENDING');
CREATE INDEX ix_hike_record_user_id ON hike_record (user_id);
CREATE INDEX ix_hike_record_course_id ON hike_record (course_id);
CREATE INDEX ix_hike_record_recorded_course_geometry
    ON hike_record USING GIST (recorded_course_geometry);

CREATE INDEX ix_mountain_review_target
    ON mountain_review (mountain_id, created_at)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_mountain_review_user_id ON mountain_review (user_id);
CREATE INDEX ix_mountain_review_mountain_id ON mountain_review (mountain_id);

CREATE INDEX ix_course_review_target
    ON course_review (course_id, created_at)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_course_review_user_id ON course_review (user_id);
CREATE INDEX ix_course_review_course_id ON course_review (course_id);

CREATE INDEX ix_user_spot_spot_location ON user_spot USING GIST (spot_location);
CREATE INDEX ix_user_spot_user_id ON user_spot (user_id);
CREATE INDEX ix_user_spot_mountain_id ON user_spot (mountain_id);
CREATE INDEX ix_user_spot_hike_record_id ON user_spot (hike_record_id);

CREATE INDEX ix_spot_review_target
    ON spot_review (spot_id, created_at)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_spot_review_user_id ON spot_review (user_id);
CREATE INDEX ix_spot_review_spot_id ON spot_review (spot_id);

CREATE UNIQUE INDEX uq_facility_report_active
    ON facility_report (facility_id, user_id, visited_date, report_type)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_facility_report_user ON facility_report (user_id);
CREATE INDEX ix_facility_report_facility_id ON facility_report (facility_id);

CREATE INDEX ix_photo_user_id ON photo (user_id);
CREATE INDEX ix_photo_mountain_review_id ON photo (mountain_review_id);
CREATE INDEX ix_photo_course_review_id ON photo (course_review_id);
CREATE INDEX ix_photo_spot_review_id ON photo (spot_review_id);
CREATE INDEX ix_photo_spot_id ON photo (spot_id);
