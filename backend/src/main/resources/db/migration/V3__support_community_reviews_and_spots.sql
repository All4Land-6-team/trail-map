ALTER TABLE mountain_review
    ADD COLUMN hike_record_id BIGINT,
    ADD CONSTRAINT fk_mountain_review_hike_record
        FOREIGN KEY (hike_record_id) REFERENCES hike_record (hike_record_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT chk_mountain_review_rating
        CHECK (rating BETWEEN 1 AND 5),
    ADD CONSTRAINT chk_mountain_review_content_length
        CHECK (length(review_content) <= 1000);

ALTER TABLE course_review
    ADD COLUMN hike_record_id BIGINT,
    ADD CONSTRAINT fk_course_review_hike_record
        FOREIGN KEY (hike_record_id) REFERENCES hike_record (hike_record_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT chk_course_review_content_length
        CHECK (length(review_content) <= 1000);

ALTER TABLE user_spot
    DROP CONSTRAINT chk_user_spot_type,
    ADD CONSTRAINT chk_user_spot_type
        CHECK (spot_type IN ('REST_AREA', 'DRINKING_FOUNTAIN', 'RESTROOM', 'PHOTO_SPOT', 'OTHER'));

ALTER TABLE spot_review
    ALTER COLUMN spot_id DROP NOT NULL,
    ADD COLUMN facility_id BIGINT,
    ADD COLUMN hike_record_id BIGINT,
    ADD CONSTRAINT fk_spot_review_facility
        FOREIGN KEY (facility_id) REFERENCES facility (facility_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT fk_spot_review_hike_record
        FOREIGN KEY (hike_record_id) REFERENCES hike_record (hike_record_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT chk_spot_review_single_target
        CHECK (num_nonnulls(spot_id, facility_id) = 1),
    ADD CONSTRAINT chk_spot_review_content_length
        CHECK (length(review_content) <= 1000);

ALTER TABLE photo
    ADD COLUMN facility_id BIGINT,
    ADD CONSTRAINT fk_photo_facility
        FOREIGN KEY (facility_id) REFERENCES facility (facility_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    DROP CONSTRAINT chk_photo_single_target,
    ADD CONSTRAINT chk_photo_single_target
        CHECK (num_nonnulls(mountain_review_id, course_review_id, spot_review_id, spot_id, facility_id) = 1);

CREATE TABLE spot_vote (
    vote_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    spot_id BIGINT,
    facility_id BIGINT,
    vote_type VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_spot_vote_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_spot_vote_spot
        FOREIGN KEY (spot_id) REFERENCES user_spot (spot_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_spot_vote_facility
        FOREIGN KEY (facility_id) REFERENCES facility (facility_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT uq_spot_vote_user_spot
        UNIQUE (user_id, spot_id),
    CONSTRAINT uq_spot_vote_user_facility
        UNIQUE (user_id, facility_id),
    CONSTRAINT chk_spot_vote_single_target
        CHECK (num_nonnulls(spot_id, facility_id) = 1),
    CONSTRAINT chk_spot_vote_type
        CHECK (vote_type IN ('YES', 'NO'))
);

CREATE INDEX ix_mountain_review_hike_record_id ON mountain_review (hike_record_id);
CREATE INDEX ix_course_review_hike_record_id ON course_review (hike_record_id);
CREATE INDEX ix_spot_review_facility_target
    ON spot_review (facility_id, created_at)
    WHERE deleted_at IS NULL;
CREATE INDEX ix_spot_review_facility_id ON spot_review (facility_id);
CREATE INDEX ix_spot_review_hike_record_id ON spot_review (hike_record_id);
CREATE INDEX ix_photo_facility_id ON photo (facility_id);
CREATE INDEX ix_spot_vote_spot_id ON spot_vote (spot_id);
CREATE INDEX ix_spot_vote_facility_id ON spot_vote (facility_id);
