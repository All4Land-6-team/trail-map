ALTER TABLE course_review
    ADD COLUMN rating NUMERIC,
    ADD CONSTRAINT chk_course_review_rating
        CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE mountain_review
    DROP CONSTRAINT chk_mountain_review_rating,
    DROP COLUMN rating;
