package com.all4land.trailmap.domain.courseroute.importer;

import com.all4land.trailmap.domain.courseroute.service.CourseRouteImportService;
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
@ConditionalOnProperty(name = "course-route.import.enabled", havingValue = "true")
public class CourseRouteImportRunner implements ApplicationRunner {
    private final CourseRouteImportService service;
    private final ConfigurableApplicationContext context;
    @Value("${course-route.import.file}") private String file;
    @Value("${course-route.import.bukhansan-mountain-id}") private long bukhansanId;
    @Value("${course-route.import.dobongsan-mountain-id}") private long dobongsanId;
    @Value("${spring.main.web-application-type:servlet}") private String applicationType;

    @Override
    public void run(ApplicationArguments args) {
        if (!"none".equalsIgnoreCase(applicationType)) throw new IllegalStateException("Route import requires a non-web CLI process");
        var result = service.importFile(Path.of(file), bukhansanId, dobongsanId);
        log.info("Course route import complete: sourceId={}, inserted={}, existing={}", result.sourceId(), result.inserted(), result.existing());
        context.close();
    }
}
