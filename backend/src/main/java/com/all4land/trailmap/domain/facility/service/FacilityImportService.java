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

@Service
@RequiredArgsConstructor
public class FacilityImportService {
    private final FacilityImportRepository repository;
    private final ObjectMapper mapper;
    private final Validator validator;

    /** 실패하면 출처와 시설 INSERT를 모두 롤백한다. 기존 행의 UPDATE/DELETE는 하지 않는다. */
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
        Map<String, String> existing = repository.findHashes(sourceId);
        var inserts = new ArrayList<FacilityInput>();
        for (FacilityInput record : document.facilities()) {
            String oldHash = existing.get(record.sourceRecordId());
            if (oldHash == null) {
                inserts.add(record);
            } else if (!oldHash.equals(hashes.get(record.sourceRecordId()))) {
                throw new IllegalArgumentException("Existing record changed; update is not supported: " + record.sourceRecordId());
            }
        }
        repository.insert(sourceId, inserts, hashes);
        return new ImportResult(sourceId, document.facilities().size(), inserts.size(),
                document.facilities().size() - inserts.size());
    }

    private String hash(FacilityInput record) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(mapper.writeValueAsBytes(record)));
        } catch (IOException | NoSuchAlgorithmException error) {
            throw new IllegalStateException("Cannot hash normalized facility", error);
        }
    }

    public record ImportResult(long sourceId, int total, int inserted, int skipped) {}
}
