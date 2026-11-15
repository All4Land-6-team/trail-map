CREATE TABLE spot_course (
    spot_course_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id BIGINT REFERENCES facility (facility_id) ON DELETE CASCADE,
    user_spot_id BIGINT REFERENCES user_spot (spot_id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES course (course_id) ON DELETE CASCADE,
    distance_meters DOUBLE PRECISION,
    matching_method VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_spot_course_target
        CHECK (num_nonnulls(facility_id, user_spot_id) = 1),
    CONSTRAINT chk_spot_course_distance
        CHECK (distance_meters IS NULL OR distance_meters >= 0),
    CONSTRAINT chk_spot_course_matching_method
        CHECK (matching_method IN ('SPATIAL_BUFFER', 'HIKE_RECORD', 'USER_SELECTED'))
);

CREATE UNIQUE INDEX uq_spot_course_facility
    ON spot_course (facility_id, course_id)
    WHERE facility_id IS NOT NULL;
CREATE UNIQUE INDEX uq_spot_course_user_spot
    ON spot_course (user_spot_id, course_id)
    WHERE user_spot_id IS NOT NULL;
CREATE INDEX ix_spot_course_course_id ON spot_course (course_id);

INSERT INTO spot_course (facility_id, course_id, distance_meters, matching_method)
SELECT facility.facility_id,
       course.course_id,
       ST_Distance(facility.facility_location::geography, course.course_geometry::geography),
       'SPATIAL_BUFFER'
FROM facility
JOIN course ON course.mountain_id = facility.mountain_id
WHERE facility.mountain_id IS NOT NULL
  AND ST_DWithin(
        facility.facility_location::geography,
        course.course_geometry::geography,
        30
      )
ON CONFLICT DO NOTHING;

INSERT INTO spot_course (user_spot_id, course_id, matching_method)
SELECT spot.spot_id, record.course_id, 'HIKE_RECORD'
FROM user_spot spot
JOIN hike_record record ON record.hike_record_id = spot.hike_record_id
JOIN course ON course.course_id = record.course_id
WHERE spot.hike_record_id IS NOT NULL
  AND (spot.mountain_id IS NULL OR spot.mountain_id = course.mountain_id)
ON CONFLICT DO NOTHING;
