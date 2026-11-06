CREATE TABLE park_access_control (
    control_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    source_record_id VARCHAR(20) NOT NULL UNIQUE,
    mountain_key VARCHAR(30) NOT NULL UNIQUE,
    office_name VARCHAR(100) NOT NULL,
    source_url VARCHAR(4000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN' CHECK (status IN ('UNKNOWN','NORMAL','PARTIAL','CLOSED')),
    reason TEXT, content_text TEXT, restricted_section TEXT, restriction_period_text TEXT, contact TEXT,
    source_as_of TIMESTAMPTZ, checked_at TIMESTAMPTZ, detail_fetched_at TIMESTAMPTZ, last_attempt_at TIMESTAMPTZ,
    collection_state VARCHAR(20) NOT NULL DEFAULT 'MISSING' CHECK (collection_state IN ('MISSING','READY','ERROR','ASSET_ERROR')),
    CHECK ((source_record_id = '0019' AND mountain_key = 'bukhansan') OR (source_record_id = '0020' AND mountain_key = 'dobongsan'))
);
CREATE TABLE park_access_control_asset (
    control_id BIGINT NOT NULL REFERENCES park_access_control(control_id) ON DELETE CASCADE,
    asset_order INTEGER NOT NULL,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('INLINE','ATTACHMENT')),
    name VARCHAR(500) NOT NULL,
    source_url VARCHAR(4000) NOT NULL,
    object_key VARCHAR(500), media_type VARCHAR(50),
    PRIMARY KEY (control_id, asset_order)
);
-- Source identifiers only. Live status is UNKNOWN until collection succeeds.
INSERT INTO park_access_control (source_record_id, mountain_key, office_name, source_url) VALUES
('0019', 'bukhansan', '북한산사무소', 'https://www.knps.or.kr/front/portal/safe/acsCtrDtl.do?menuNo=8000340&rstId=0019'),
('0020', 'dobongsan', '북한산도봉사무소', 'https://www.knps.or.kr/front/portal/safe/acsCtrDtl.do?menuNo=8000340&rstId=0020');
