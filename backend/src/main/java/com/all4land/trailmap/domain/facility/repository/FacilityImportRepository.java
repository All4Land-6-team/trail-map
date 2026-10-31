package com.all4land.trailmap.domain.facility.repository;

import com.all4land.trailmap.domain.facility.dto.request.FacilityImportDocument.Source;
import com.all4land.trailmap.domain.facility.dto.request.FacilityImportDocument.FacilityInput;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class FacilityImportRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public void lockImport() {
        // data_source에 출처 식별 UNIQUE 제약이 없으므로 이 적재기의 동시 실행을 직렬화한다.
        jdbc.getJdbcTemplate().execute("SELECT pg_advisory_xact_lock(1953653097)");
    }

    public long findOrCreateSource(Source source) {
        var params = new MapSqlParameterSource("name", source.name()).addValue("provider", source.provider())
                .addValue("url", source.url()).addValue("format", source.format())
                .addValue("crs", source.crs()).addValue("version", source.version());
        List<Map<String, Object>> matches = jdbc.queryForList("""
                SELECT source_id, source_url, source_crs FROM data_source
                WHERE source_name = :name AND provider_name IS NOT DISTINCT FROM :provider
                    AND source_format = :format AND source_version = :version
                """, params);
        if (matches.size() > 1) {
            throw new IllegalArgumentException("Ambiguous data_source identity; resolve duplicate sources first");
        }
        if (!matches.isEmpty()) {
            var existing = matches.getFirst();
            if (!java.util.Objects.equals(existing.get("source_url"), source.url())
                    || !java.util.Objects.equals(existing.get("source_crs"), source.crs())) {
                throw new IllegalArgumentException("Source metadata changed; updates are not supported by this importer");
            }
            return ((Number) existing.get("source_id")).longValue();
        }
        return jdbc.queryForObject("""
                INSERT INTO data_source (source_name, provider_name, source_url, source_format, source_crs, source_version)
                VALUES (:name, :provider, :url, :format, :crs, :version) RETURNING source_id
                """, params, Long.class);
    }

    public record ExistingFacility(String sourceHash) {}

    public Map<String, ExistingFacility> findExisting(long sourceId) {
        Map<String, ExistingFacility> records = new HashMap<>();
        jdbc.query("SELECT source_record_id, source_hash FROM facility WHERE source_id = :id FOR UPDATE",
                new MapSqlParameterSource("id", sourceId), rs -> {
                    records.put(rs.getString("source_record_id"),
                            new ExistingFacility(rs.getString("source_hash")));
                });
        return records;
    }

    public void insert(long sourceId, List<FacilityInput> records, Map<String, String> hashes) {
        if (records.isEmpty()) {
            return;
        }
        var batch = records.stream().map(record -> new MapSqlParameterSource()
                .addValue("sourceId", sourceId).addValue("recordId", record.sourceRecordId())
                .addValue("name", record.name()).addValue("type", record.type().name())
                .addValue("longitude", record.longitude()).addValue("latitude", record.latitude())
                .addValue("status", record.sourceReportedStatus())
                .addValue("date", record.sourceDate(), Types.DATE)
                .addValue("mountainId", record.mountainId(), Types.BIGINT)
                .addValue("hash", hashes.get(record.sourceRecordId()))).toArray(MapSqlParameterSource[]::new);
        jdbc.batchUpdate("""
                INSERT INTO facility (facility_name, facility_type, facility_location, official_status,
                    source_id, source_record_id, source_date, source_hash, imported_at, mountain_id)
                VALUES (:name, :type, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326), :status,
                    :sourceId, :recordId, :date, :hash, CURRENT_TIMESTAMP, :mountainId)
                """, batch);
    }
}
