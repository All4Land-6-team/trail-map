package com.all4land.trailmap.domain.facility.service;

import com.all4land.trailmap.domain.facility.dto.request.FacilityImportDocument;
import com.all4land.trailmap.domain.facility.dto.request.FacilityImportDocument.FacilityInput;
import com.all4land.trailmap.domain.facility.repository.FacilityImportRepository;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class FacilityImportService {
    private final FacilityImportRepository repository;
    private final ObjectMapper mapper;
    private final Validator validator;

    /** 원본은 불변으로 유지하며 산 소속만 갱신한다. 실패하면 모든 INSERT/UPDATE를 롤백한다. */
    @Transactional
    public ImportResult importFile(Path path) {
        FacilityImportDocument document;
        try {
            if (Files.size(path) > 20 * 1024 * 1024) {
                throw new IllegalArgumentException("Import file exceeds 20 MiB");
            }
            document = mapper.readerFor(FacilityImportDocument.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(path.toFile());
        } catch (IOException error) {
            throw new IllegalArgumentException("Cannot read facility import JSON: " + path, error);
        }
        if (document == null) {
            throw new IllegalArgumentException("Import document is null");
        }
        var violations = validator.validate(document);
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException("Invalid import document: " + violations.stream()
                    .map(v -> v.getPropertyPath() + " " + v.getMessage()).sorted().toList());
        }
        Map<String, String> hashes = new LinkedHashMap<>();
        for (FacilityInput record : document.facilities()) {
            if (!Double.isFinite(record.longitude()) || !Double.isFinite(record.latitude())
                    || record.longitude() < -180 || record.longitude() > 180
                    || record.latitude() < -90 || record.latitude() > 90) {
                throw new IllegalArgumentException("Invalid WGS84 coordinates: " + record.sourceRecordId());
            }
            if (hashes.putIfAbsent(record.sourceRecordId(), hash(record)) != null) {
                throw new IllegalArgumentException("Duplicate sourceRecordId: " + record.sourceRecordId());
            }
        }
        repository.lockImport();
        long sourceId = repository.findOrCreateSource(document.source());
        var existing = repository.findExisting(sourceId);
        var inserts = new ArrayList<FacilityInput>();
        var updates = new ArrayList<FacilityInput>();
        for (FacilityInput record : document.facilities()) {
            var previous = existing.get(record.sourceRecordId());
            if (previous == null) {
                inserts.add(record);
            } else if (!previous.sourceHash().equals(hashes.get(record.sourceRecordId()))) {
                throw new IllegalArgumentException("Existing record changed; update is not supported: " + record.sourceRecordId());
            } else if (!Objects.equals(previous.mountainId(), record.mountainId())) {
                updates.add(record);
            }
        }
        repository.insert(sourceId, inserts, hashes);
        repository.updateMountains(sourceId, updates);
        return new ImportResult(sourceId, document.facilities().size(), inserts.size(), updates.size(),
                document.facilities().size() - inserts.size() - updates.size());
    }

    private String hash(FacilityInput record) {
        try {
            // v1의 필드 순서와 직렬화를 보존한다. 파생된 mountainId는 원본 해시에 넣지 않는다.
            Map<String, Object> original = new LinkedHashMap<>();
            original.put("sourceRecordId", record.sourceRecordId());
            original.put("type", record.type());
            original.put("name", record.name());
            original.put("longitude", record.longitude());
            original.put("latitude", record.latitude());
            original.put("sourceReportedStatus", record.sourceReportedStatus());
            original.put("sourceDate", record.sourceDate());
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(mapper.writeValueAsBytes(original)));
        } catch (IOException | NoSuchAlgorithmException error) {
            throw new IllegalStateException("Cannot hash normalized facility", error);
        }
    }

    public record ImportResult(long sourceId, int total, int inserted, int updated, int skipped) {}
}
