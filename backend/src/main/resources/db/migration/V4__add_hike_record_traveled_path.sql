-- 등산 중 GPS로 실제 이동한 경로. recorded_course_geometry(시작 시 코스 경로 스냅샷)와 구분한다.
-- 첫 위치만 받은 동안에는 같은 점 두 개로 된 선을 저장하므로 ST_IsValid 대신 점 개수만 검사한다.
ALTER TABLE hike_record
    ADD COLUMN traveled_path geometry(LineString, 4326),
    ADD CONSTRAINT chk_hike_record_traveled_path
        CHECK (traveled_path IS NULL OR (NOT ST_IsEmpty(traveled_path) AND ST_NPoints(traveled_path) >= 2));
