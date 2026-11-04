package com.all4land.trailmap.domain.parkcontrol.repository;

import com.all4land.trailmap.domain.parkcontrol.collector.KnpsSource.Detail;
import com.all4land.trailmap.domain.parkcontrol.collector.KnpsSource.Office;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.Instant;

@Repository
public class ControlImportRepository {
    private final JdbcTemplate db;
    public ControlImportRepository(JdbcTemplate db) { this.db = db; }

    @Transactional
    public void save(Office office, Detail detail, Instant attempt, String state) {
        var now = Timestamp.from(Instant.now());
        int updated = db.update("""
            UPDATE park_access_control SET version=version+1, source_url=?, status=?, reason=?, content_text=?,
                restricted_section=?, restriction_period_text=?, contact=?, source_as_of=?, checked_at=?,
                detail_fetched_at=?, last_attempt_at=?, collection_state=?
            WHERE source_record_id=? AND (last_attempt_at IS NULL OR last_attempt_at <= ?)
            """, office.url(), office.status(), detail == null ? null : detail.reason(), detail == null ? null : detail.text(),
                detail == null ? null : detail.section(), detail == null ? null : detail.period(),
                detail == null ? null : detail.contact(), Timestamp.from(detail == null ? office.asOf() : detail.asOf()),
                now, detail == null ? null : now, Timestamp.from(attempt), state, office.id(), Timestamp.from(attempt));
        if (updated == 0) return;
        Long id = db.queryForObject("SELECT control_id FROM park_access_control WHERE source_record_id=?", Long.class, office.id());
        db.update("DELETE FROM park_access_control_asset WHERE control_id=?", id);
        if (detail != null) for (int i = 0; i < detail.assets().size(); i++) {
            var a = detail.assets().get(i);
            db.update("""
                INSERT INTO park_access_control_asset(control_id,asset_order,kind,name,source_url,object_key,media_type)
                VALUES(?,?,?,?,?,?,?)
                """, id, i, a.getKind(), a.getName(), a.getSourceUrl(), a.getObjectKey(), a.getMediaType());
        }
    }

    public void failed(String id, Instant attempt) {
        db.update("""
            UPDATE park_access_control SET version=version+1, collection_state='ERROR', last_attempt_at=?
            WHERE source_record_id=? AND (last_attempt_at IS NULL OR last_attempt_at <= ?)
            """, Timestamp.from(attempt), id, Timestamp.from(attempt));
    }
}
