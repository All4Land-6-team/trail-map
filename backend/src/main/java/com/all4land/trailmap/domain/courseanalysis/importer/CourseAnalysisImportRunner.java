package com.all4land.trailmap.domain.courseanalysis.importer;

import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisImportService;
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
@ConditionalOnProperty(name = "course-analysis.import.enabled", havingValue = "true")
public class CourseAnalysisImportRunner implements ApplicationRunner {
    private final CourseAnalysisImportService service;
    private final ConfigurableApplicationContext context;

    @Value("${course-analysis.import.file}")
    private String file;
    @Value("${course-analysis.import.dem-source-name}")
    private String sourceName;
    @Value("${course-analysis.import.dem-provider:}")
    private String provider;

    @Override
    public void run(ApplicationArguments args) {
        var result = service.importFile(Path.of(file), sourceName, provider);
        log.info("Course analysis import complete: analysisId={}, demSourceId={}, inserted={}",
                result.analysisId(), result.demSourceId(), result.inserted());
        context.close();
    }
}
