CREATE TABLE weather_station (
    station_id INTEGER PRIMARY KEY,
    station_name VARCHAR(200) NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    elevation_meters DOUBLE PRECISION,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_weather_station_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_weather_station_latitude CHECK (latitude BETWEEN -90 AND 90)
);

CREATE INDEX ix_weather_station_location
    ON weather_station USING GIST ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography));

ALTER TABLE photo
    ADD COLUMN captured_at TIMESTAMPTZ,
    ADD COLUMN capture_utc_offset_minutes SMALLINT,
    ADD COLUMN capture_longitude DOUBLE PRECISION,
    ADD COLUMN capture_latitude DOUBLE PRECISION,
    ADD COLUMN weather_temperature_c DOUBLE PRECISION,
    ADD COLUMN weather_code VARCHAR(30),
    ADD COLUMN weather_observed_at TIMESTAMPTZ,
    ADD COLUMN weather_station_id INTEGER,
    ADD CONSTRAINT fk_photo_weather_station
        FOREIGN KEY (weather_station_id) REFERENCES weather_station (station_id)
        ON DELETE SET NULL ON UPDATE RESTRICT,
    ADD CONSTRAINT chk_photo_capture_metadata
        CHECK (
            (captured_at IS NULL
                AND capture_utc_offset_minutes IS NULL
                AND capture_longitude IS NULL
                AND capture_latitude IS NULL)
            OR
            (captured_at IS NOT NULL
                AND capture_utc_offset_minutes BETWEEN -1080 AND 1080
                AND capture_longitude BETWEEN -180 AND 180
                AND capture_latitude BETWEEN -90 AND 90)
        ),
    ADD CONSTRAINT chk_photo_weather_code
        CHECK (weather_code IS NULL OR weather_code IN (
            'SUNNY', 'PARTLY_CLOUDY', 'CLOUDY', 'RAIN', 'SNOW', 'FOG', 'THUNDERSTORM'
        ));
