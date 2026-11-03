package com.all4land.trailmap.domain.courseanalysis.storage;

import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisDocumentRepository;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader;
import com.all4land.trailmap.global.config.CourseAnalysisConfig;
import com.all4land.trailmap.global.config.CourseAnalysisProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static com.all4land.trailmap.domain.courseanalysis.AnalysisTestDocuments.mapper;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class CourseAnalysisStorageConfigurationTest {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(CourseAnalysisConfig.class, CourseAnalysisDatabaseStore.class, CourseAnalysisFileStore.class)
            .withBean(CourseAnalysisDocumentRepository.class, () -> mock(CourseAnalysisDocumentRepository.class))
            .withBean(CourseAnalysisDocumentReader.class, () -> new CourseAnalysisDocumentReader(mapper()));

    @Test
    void databaseIsTheDefaultAndDoesNotRequireAFileRoot() {
        context.run(application -> {
            assertThat(application).hasSingleBean(CourseAnalysisStore.class).hasSingleBean(CourseAnalysisDatabaseStore.class)
                    .doesNotHaveBean(CourseAnalysisFileStore.class);
            assertThat(application.getBean(CourseAnalysisProperties.class).storage())
                    .isEqualTo(CourseAnalysisProperties.Storage.DATABASE);
        });
        context.withPropertyValues("course-analysis.storage=database").run(application ->
                assertThat(application).hasSingleBean(CourseAnalysisStore.class).hasSingleBean(CourseAnalysisDatabaseStore.class));
    }

    @Test
    void explicitFileModeKeepsTheLegacyStore() {
        context.withPropertyValues("course-analysis.storage=file", "course-analysis.root-path=./local-store")
                .run(application -> {
                    assertThat(application).hasSingleBean(CourseAnalysisStore.class).hasSingleBean(CourseAnalysisFileStore.class)
                            .doesNotHaveBean(CourseAnalysisDatabaseStore.class);
                    assertThat(application.getBean(CourseAnalysisProperties.class).storage())
                            .isEqualTo(CourseAnalysisProperties.Storage.FILE);
                });
    }

    @Test
    void invalidStorageModeFailsAtStartup() {
        context.withPropertyValues("course-analysis.storage=databse").run(application ->
                assertThat(application).hasFailed());
    }
}
