ALTER TABLE mountain
    ADD COLUMN asos_station_id INTEGER,
    ADD CONSTRAINT chk_mountain_asos_station_id
        CHECK (asos_station_id IS NULL OR asos_station_id > 0);

ALTER TABLE review_environment
    ADD COLUMN weather_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD CONSTRAINT chk_review_environment_weather_status
        CHECK (weather_status IN ('PENDING', 'SUCCESS', 'FAILED'));

UPDATE review_environment
SET weather_status = CASE
    WHEN weather_temperature_c IS NOT NULL OR weather_code IS NOT NULL THEN 'SUCCESS'
    ELSE 'FAILED'
END;

ALTER TABLE review_environment
    DROP CONSTRAINT fk_review_environment_weather_station,
    DROP COLUMN weather_observed_at,
    DROP COLUMN weather_station_id;

DROP TABLE weather_station;
