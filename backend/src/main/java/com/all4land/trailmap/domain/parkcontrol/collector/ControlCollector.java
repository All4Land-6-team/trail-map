package com.all4land.trailmap.domain.parkcontrol.collector;

import com.all4land.trailmap.domain.parkcontrol.repository.ControlImportRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.time.Instant;
import java.util.Map;

@Service
public class ControlCollector {
    private static final Logger log = LoggerFactory.getLogger(ControlCollector.class);
    private final KnpsSource source;
    private final ControlAssetImporter images;
    private final ControlImportRepository repository;

    public ControlCollector(KnpsSource source, ControlAssetImporter images, ControlImportRepository repository) {
        this.source = source;
        this.images = images;
        this.repository = repository;
    }

    public void collect() throws IOException {
        Instant attempt = Instant.now();
        Map<String,KnpsSource.Office> offices;
        try {
            offices = KnpsSource.offices(source.fetch(KnpsSource.LIST));
        } catch (Exception e) {
            KnpsSource.OFFICES.keySet().forEach(id -> repository.failed(id, attempt));
            throw new IOException("공단 목록 수집 실패", e);
        }
        IOException failures = new IOException("일부 사무소 수집 실패");
        for (var office : offices.values()) {
            try {
                KnpsSource.Detail detail = null;
                String state = "READY";
                if (!office.status().equals("NORMAL")) {
                    detail = KnpsSource.detail(source.fetch(office.url()), office);
                    for (var asset : detail.assets()) {
                        try { images.store(office.id(), asset); }
                        catch (Exception e) {
                            state = "ASSET_ERROR";
                            log.warn("이미지 저장 실패 office={} kind={} error={}", office.id(), asset.getKind(), e.getClass().getSimpleName());
                        }
                    }
                }
                repository.save(office, detail, attempt, state);
                log.info("공단 수집 office={} status={} collection={}", office.id(), office.status(), state);
                if (state.equals("ASSET_ERROR")) failures.addSuppressed(new IOException(office.id() + " 이미지 저장 실패"));
            } catch (Exception e) {
                repository.failed(office.id(), attempt);
                failures.addSuppressed(e);
            }
        }
        if (failures.getSuppressed().length != 0) throw failures;
    }
}
