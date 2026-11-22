-- 오프라인 재전송으로 같은 위치가 다시 오면 이동 경로에 두 번 붙지 않도록 마지막으로 받은 위치의 측정 시각을 저장한다.
ALTER TABLE hike_record ADD COLUMN last_position_recorded_at TIMESTAMPTZ;

COMMENT ON COLUMN hike_record.last_position_recorded_at IS '이동 경로에 마지막으로 붙인 위치의 기기 측정 시각. 이 시각 이전 위치는 다시 받지 않는다.';
