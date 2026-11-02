package com.all4land.trailmap.global.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

import java.net.URI;
import java.nio.file.Path;

@ConfigurationProperties(prefix = "course-analysis")
public record CourseAnalysisProperties(String rootPath, Storage storage) {
    public enum Storage { DATABASE, FILE }

    @ConstructorBinding
    public CourseAnalysisProperties {
        storage = storage == null ? Storage.DATABASE : storage;
    }

    public CourseAnalysisProperties(String rootPath) {
        this(rootPath, Storage.DATABASE);
    }

    public Path directory() {
        String location = rootPath == null ? "../data/processed/course-analysis-store" : rootPath;
        return (location.startsWith("file:") ? Path.of(URI.create(location)) : Path.of(location))
                .toAbsolutePath().normalize();
    }
}
