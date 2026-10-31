-- 새 정책 적용 전에 기존 활성 중복은 최신 후기 1건만 남기고 소프트 삭제한다.
WITH ranked_review AS (
    SELECT review_id,
           row_number() OVER (
               PARTITION BY hike_record_id, mountain_id
               ORDER BY created_at DESC, review_id DESC
           ) AS duplicate_rank
    FROM mountain_review
    WHERE deleted_at IS NULL
      AND hike_record_id IS NOT NULL
)
UPDATE mountain_review review
SET deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
FROM ranked_review ranked
WHERE review.review_id = ranked.review_id
  AND ranked.duplicate_rank > 1;

WITH ranked_review AS (
    SELECT review_id,
           row_number() OVER (
               PARTITION BY hike_record_id, course_id
               ORDER BY created_at DESC, review_id DESC
           ) AS duplicate_rank
    FROM course_review
    WHERE deleted_at IS NULL
      AND hike_record_id IS NOT NULL
)
UPDATE course_review review
SET deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
FROM ranked_review ranked
WHERE review.review_id = ranked.review_id
  AND ranked.duplicate_rank > 1;

WITH ranked_review AS (
    SELECT review_id,
           row_number() OVER (
               PARTITION BY hike_record_id, spot_id
               ORDER BY created_at DESC, review_id DESC
           ) AS duplicate_rank
    FROM spot_review
    WHERE deleted_at IS NULL
      AND hike_record_id IS NOT NULL
      AND spot_id IS NOT NULL
)
UPDATE spot_review review
SET deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
FROM ranked_review ranked
WHERE review.review_id = ranked.review_id
  AND ranked.duplicate_rank > 1;

WITH ranked_review AS (
    SELECT review_id,
           row_number() OVER (
               PARTITION BY hike_record_id, facility_id
               ORDER BY created_at DESC, review_id DESC
           ) AS duplicate_rank
    FROM spot_review
    WHERE deleted_at IS NULL
      AND hike_record_id IS NOT NULL
      AND facility_id IS NOT NULL
)
UPDATE spot_review review
SET deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
FROM ranked_review ranked
WHERE review.review_id = ranked.review_id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX uq_mountain_review_hike_target_active
    ON mountain_review (hike_record_id, mountain_id)
    WHERE deleted_at IS NULL AND hike_record_id IS NOT NULL;

CREATE UNIQUE INDEX uq_course_review_hike_target_active
    ON course_review (hike_record_id, course_id)
    WHERE deleted_at IS NULL AND hike_record_id IS NOT NULL;

CREATE UNIQUE INDEX uq_spot_review_hike_user_spot_active
    ON spot_review (hike_record_id, spot_id)
    WHERE deleted_at IS NULL AND hike_record_id IS NOT NULL AND spot_id IS NOT NULL;

CREATE UNIQUE INDEX uq_spot_review_hike_facility_active
    ON spot_review (hike_record_id, facility_id)
    WHERE deleted_at IS NULL AND hike_record_id IS NOT NULL AND facility_id IS NOT NULL;
