package com.all4land.trailmap.domain.facility.importer;

import com.all4land.trailmap.domain.facility.service.FacilityImportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

import java.nio.file.Path;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "facility.import.enabled", havingValue = "true")
public class FacilityImportRunner implements ApplicationRunner {
    private final FacilityImportService service;
    private final ConfigurableApplicationContext context;

    @Value("${facility.import.file}")
    private String file;

    @Override
    public void run(ApplicationArguments args) {
        var result = service.importFile(Path.of(file));
        log.info("Facility import complete: sourceId={}, total={}, inserted={}, skipped={}",
                result.sourceId(), result.total(), result.inserted(), result.skipped());
        context.close();
    }
}
