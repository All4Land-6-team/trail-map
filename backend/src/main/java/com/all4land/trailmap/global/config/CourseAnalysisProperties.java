package com.all4land.trailmap.global.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.nio.file.Path;

@ConfigurationProperties(prefix = "course-analysis")
public record CourseAnalysisProperties(String rootPath) {
    public Path directory() {
        String location = rootPath == null ? "../data/processed/course-analysis-store" : rootPath;
        return (location.startsWith("file:") ? Path.of(URI.create(location)) : Path.of(location))
                .toAbsolutePath().normalize();
    }
}
