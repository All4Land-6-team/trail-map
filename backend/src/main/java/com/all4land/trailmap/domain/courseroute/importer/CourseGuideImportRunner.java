package com.all4land.trailmap.domain.courseroute.importer;

import com.all4land.trailmap.domain.courseroute.service.CourseGuideImportService;
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
@ConditionalOnProperty(name = "course-guide.import.enabled", havingValue = "true")
public class CourseGuideImportRunner implements ApplicationRunner {
    private final CourseGuideImportService service;
    private final ConfigurableApplicationContext context;
    @Value("${course-guide.import.file}") private String file;
    @Value("${spring.main.web-application-type:servlet}") private String applicationType;
    @Override public void run(ApplicationArguments args) {
        if (!"none".equalsIgnoreCase(applicationType)) throw new IllegalStateException("Guide import requires a non-web CLI process");
        var result = service.importFile(Path.of(file));
        log.info("Course guide import complete: inserted={}, existing={}", result.inserted(), result.existing());
        context.close();
    }
}
