UPDATE mountain
SET asos_station_id = 108,
    updated_at = CURRENT_TIMESTAMP
WHERE source_record_id IN ('bukhansan', 'dobongsan');
