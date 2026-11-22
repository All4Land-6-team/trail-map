CREATE TABLE review_environment (
    review_environment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mountain_review_id BIGINT,
    course_review_id BIGINT,
    spot_review_id BIGINT,
    reference_at TIMESTAMPTZ NOT NULL,
    utc_offset_minutes SMALLINT NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    source VARCHAR(30) NOT NULL,
    weather_temperature_c DOUBLE PRECISION,
    weather_code VARCHAR(30),
    weather_observed_at TIMESTAMPTZ,
    weather_station_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_environment_mountain_review
        FOREIGN KEY (mountain_review_id) REFERENCES mountain_review (review_id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_review_environment_course_review
        FOREIGN KEY (course_review_id) REFERENCES course_review (review_id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_review_environment_spot_review
        FOREIGN KEY (spot_review_id) REFERENCES spot_review (review_id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_review_environment_weather_station
        FOREIGN KEY (weather_station_id) REFERENCES weather_station (station_id)
        ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT chk_review_environment_single_review
        CHECK (num_nonnulls(mountain_review_id, course_review_id, spot_review_id) = 1),
    CONSTRAINT chk_review_environment_offset
        CHECK (utc_offset_minutes BETWEEN -1080 AND 1080),
    CONSTRAINT chk_review_environment_location
        CHECK (longitude BETWEEN -180 AND 180 AND latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_review_environment_source
        CHECK (source IN ('PHOTO_EXIF', 'HIKE_MIDPOINT')),
    CONSTRAINT chk_review_environment_weather_code
        CHECK (weather_code IS NULL OR weather_code IN (
            'SUNNY', 'PARTLY_CLOUDY', 'CLOUDY', 'RAIN', 'SNOW', 'FOG', 'THUNDERSTORM'
        ))
);

CREATE UNIQUE INDEX uq_review_environment_mountain_review
    ON review_environment (mountain_review_id) WHERE mountain_review_id IS NOT NULL;
CREATE UNIQUE INDEX uq_review_environment_course_review
    ON review_environment (course_review_id) WHERE course_review_id IS NOT NULL;
CREATE UNIQUE INDEX uq_review_environment_spot_review
    ON review_environment (spot_review_id) WHERE spot_review_id IS NOT NULL;

INSERT INTO review_environment (
    mountain_review_id, reference_at, utc_offset_minutes, longitude, latitude, source,
    weather_temperature_c, weather_code, weather_observed_at, weather_station_id
)
SELECT review.review_id, photo.captured_at, photo.capture_utc_offset_minutes,
       photo.capture_longitude, photo.capture_latitude, 'PHOTO_EXIF',
       photo.weather_temperature_c, photo.weather_code, photo.weather_observed_at, photo.weather_station_id
FROM mountain_review review
JOIN LATERAL (
    SELECT photo.* FROM photo
    WHERE photo.mountain_review_id = review.review_id AND photo.deleted_at IS NULL AND photo.captured_at IS NOT NULL
    ORDER BY photo.display_order, photo.photo_id LIMIT 1
) photo ON TRUE;

INSERT INTO review_environment (
    course_review_id, reference_at, utc_offset_minutes, longitude, latitude, source,
    weather_temperature_c, weather_code, weather_observed_at, weather_station_id
)
SELECT review.review_id, photo.captured_at, photo.capture_utc_offset_minutes,
       photo.capture_longitude, photo.capture_latitude, 'PHOTO_EXIF',
       photo.weather_temperature_c, photo.weather_code, photo.weather_observed_at, photo.weather_station_id
FROM course_review review
JOIN LATERAL (
    SELECT photo.* FROM photo
    WHERE photo.course_review_id = review.review_id AND photo.deleted_at IS NULL AND photo.captured_at IS NOT NULL
    ORDER BY photo.display_order, photo.photo_id LIMIT 1
) photo ON TRUE;

INSERT INTO review_environment (
    spot_review_id, reference_at, utc_offset_minutes, longitude, latitude, source,
    weather_temperature_c, weather_code, weather_observed_at, weather_station_id
)
SELECT review.review_id, photo.captured_at, photo.capture_utc_offset_minutes,
       photo.capture_longitude, photo.capture_latitude, 'PHOTO_EXIF',
       photo.weather_temperature_c, photo.weather_code, photo.weather_observed_at, photo.weather_station_id
FROM spot_review review
JOIN LATERAL (
    SELECT photo.* FROM photo
    WHERE photo.spot_review_id = review.review_id AND photo.deleted_at IS NULL AND photo.captured_at IS NOT NULL
    ORDER BY photo.display_order, photo.photo_id LIMIT 1
) photo ON TRUE;

INSERT INTO review_environment (
    mountain_review_id, reference_at, utc_offset_minutes, longitude, latitude, source
)
SELECT review.review_id,
       record.started_at + (COALESCE(record.ended_at, review.created_at) - record.started_at) / 2,
       540,
       ST_X(ST_LineInterpolatePoint(record.recorded_course_geometry, 0.5)),
       ST_Y(ST_LineInterpolatePoint(record.recorded_course_geometry, 0.5)),
       'HIKE_MIDPOINT'
FROM mountain_review review
JOIN hike_record record ON record.hike_record_id = review.hike_record_id
WHERE NOT EXISTS (
    SELECT 1 FROM review_environment environment WHERE environment.mountain_review_id = review.review_id
);

INSERT INTO review_environment (
    course_review_id, reference_at, utc_offset_minutes, longitude, latitude, source
)
SELECT review.review_id,
       record.started_at + (COALESCE(record.ended_at, review.created_at) - record.started_at) / 2,
       540,
       ST_X(ST_LineInterpolatePoint(record.recorded_course_geometry, 0.5)),
       ST_Y(ST_LineInterpolatePoint(record.recorded_course_geometry, 0.5)),
       'HIKE_MIDPOINT'
FROM course_review review
JOIN hike_record record ON record.hike_record_id = review.hike_record_id
WHERE NOT EXISTS (
    SELECT 1 FROM review_environment environment WHERE environment.course_review_id = review.review_id
);

INSERT INTO review_environment (
    spot_review_id, reference_at, utc_offset_minutes, longitude, latitude, source
)
SELECT review.review_id,
       record.started_at + (COALESCE(record.ended_at, review.created_at) - record.started_at) / 2,
       540,
       ST_X(COALESCE(spot.spot_location, facility.facility_location)),
       ST_Y(COALESCE(spot.spot_location, facility.facility_location)),
       'HIKE_MIDPOINT'
FROM spot_review review
JOIN hike_record record ON record.hike_record_id = review.hike_record_id
LEFT JOIN user_spot spot ON spot.spot_id = review.spot_id
LEFT JOIN facility ON facility.facility_id = review.facility_id
WHERE NOT EXISTS (
    SELECT 1 FROM review_environment environment WHERE environment.spot_review_id = review.review_id
);

ALTER TABLE photo
    DROP CONSTRAINT fk_photo_weather_station,
    DROP CONSTRAINT chk_photo_capture_metadata,
    DROP CONSTRAINT chk_photo_weather_code,
    DROP COLUMN captured_at,
    DROP COLUMN capture_utc_offset_minutes,
    DROP COLUMN capture_longitude,
    DROP COLUMN capture_latitude,
    DROP COLUMN weather_temperature_c,
    DROP COLUMN weather_code,
    DROP COLUMN weather_observed_at,
    DROP COLUMN weather_station_id;
